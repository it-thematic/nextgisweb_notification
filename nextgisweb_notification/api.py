# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from .model import NotificationSubscribeEmail, NotificationSubscribe, NotificationEmail
from nextgisweb.models import DBSession
from nextgisweb.resource import Resource, DataScope
from nextgisweb.resource.view import resource_factory
from nextgisweb.feature_layer import Feature
from nextgisweb.resource.exception import ResourceNotFound
from sqlalchemy.orm.exc import NoResultFound
import hashlib
from sqlalchemy import func, delete, distinct, update
from nextgisweb.feature_layer.interface import IFeatureLayer

# права для доступа
PERM_READ = DataScope.read
PERM_WRITE = DataScope.write


def field_collection(resource, request):
    fields = NotificationSubscribeEmail.__table__.columns._all_columns
    result = [{'key': fld.key, 'name': fld.name} for fld in fields if fld.key != 'id']
    return result

# TODO влидация на доступ к ресурсам
def get_resource_desc(resource, request):
    """
    Возвращает информацию об ресурсах.
    """
    res_ids = request.GET.get("res_id__in", None)
    if res_ids:
        res_ids = tuple(map(int, res_ids.split(',')))

    _query = DBSession.query(
            Resource.id.label('id'),
            Resource.display_name.label('resource')) \
        .filter(
            Resource.cls == 'postgis_layer')

    data = _query.filter(Resource.id.in_(res_ids)).all() if res_ids else _query.all()
    result = [elem._asdict() for elem in data]
    return result


def subscriber_collection(resource, request):
    """
    Возвращает сгруппированные подписки на объекты русурса.
    """

    # группируем email, ресурсы и принадлежащие им объекты
    data = DBSession.query(
            # TDOD feature_ids
            func.array_agg(NotificationSubscribe.feature_id).label('features'),
            NotificationSubscribe.resource_id.label('resource_id'),
            Resource.display_name.label('resource'),
            NotificationEmail.id.label('email_id'),
            NotificationEmail.email.label('email')
        )\
        .filter(
            NotificationSubscribeEmail.notification_subscribe_id == NotificationSubscribe.id)\
        .filter(
            NotificationSubscribeEmail.notification_email_id == NotificationEmail.id)\
        .filter(
            Resource.id == NotificationSubscribe.resource_id).\
        group_by(
            NotificationSubscribe.resource_id,
            NotificationEmail.id,
            Resource.id).\
        all()

    # переводим в словарь для сериализации
    result = [elem._asdict() for elem in data]

    # TODO получать наименоване объектов для отображения в таблице
    return result


def get_all_notification(resource, request):
    result = NotificationSubscribe().get_all()
    return dict(subscribers=result)


def get_all_notification_email(resource, request):
    emails = NotificationEmail().get_all()
    return emails


def create_notification_email(resource, request):
    """
    Создать нового подписчика.
    """
    email = request.json.get('email', None)
    # TODO проверка что это email
    if not email:
        return dict(succsess="Succsess create.", id=new_not.id)

    # создание ного подписчика
    new_not = NotificationEmail(email=email)
    DBSession.add(new_not)
    DBSession.flush()
    return dict(succsess="Succsess create.", id=new_not.id)


def delete_notification_email(resource, request):
    """
    Удалить подписчика.
    """
    email_id = request.json.get('email', None)
    if not email_id and isinstance(email_id, int):
        return dict(succsess="Email not found.", id=email_id)

    # удаление подписчика
    email = NotificationEmail(email=email_id)
    DBSession.delete(email)
    DBSession.flush()
    return dict(succsess="Succsess delete.", id=email.id)


def create_subscribe(email=None, resource=None, create=None):
    """
    Создание новой подписки.
    :return: list - новые объекты класса NotificationSubscribe
    :param email: NotificationEmail
    :param resource: Resource
    :param create: tuple - id объектов слоя для подписки
    :return:
    """
    try:
        # получаем все объекты слоя по их номерам id
        query = resource.feature_query()
        query.filter(["id", "in", ",".join(map(str, create))])

        # проходимся по всем объектам, создавая на них подписку
        new = list()
        for feature in query():
            new.append(
                NotificationSubscribe(
                    feature_id=feature.id,
                    resource_id=resource.id,
                    hash = get_feature_hash_sha1(feature)
                ))

        # сохраняем подписку в БД
        DBSession.add_all(new)
        DBSession.flush()

        # привязываем подписку к email
        new_link = []
        for subscriber in new:
            new_link.append(
                NotificationSubscribeEmail(
                    notification_email_id=email.id,
                    notification_subscribe_id=subscriber.id
                ))

        # сохраняем в БД
        DBSession.add_all(new_link)
    except Exception as e:
        raise e
    return new


def unsubscribe(email=None, resource=None, delete=None):
    """
    Удаление подписки на изменение ресурса.
    Удаляет либо все либо указанные подписки на конкретный ресурс.
    :param email: NotificationEmail - объект подпискича на события.
    :param resource: Resource - объект ресурса.
    :param delete: list() - список с id объектов ресурса для отписки
    :return: int колличество удаленных подписок
    """
    try:
        # отписываем подписчика либо от всех объектов либо только от указанных
        if delete:
            _feat_of_res = DBSession.query(NotificationSubscribe.id).\
                filter(
                    NotificationSubscribe.feature_id.in_(delete),
                    NotificationSubscribe.resource_id == resource.id)
        else:
            _feat_of_res = DBSession.query(NotificationSubscribe.id).\
                filter_by(
                    resource_id=resource.id)

        # получаем объекты для отписки
        _links = DBSession.query(NotificationSubscribeEmail).\
            filter(
                NotificationSubscribeEmail.notification_subscribe_id.in_([item[0] for item in _feat_of_res]),
                NotificationSubscribeEmail.notification_email_id == email.id)

        # удаления подписки
        _delete_count = _links.delete()

        # удаляем пустые подписки у которых нет подписчиков
        delete_lonly_subscribe()
    except Exception as e:
        raise e
    return _delete_count


def delete_lonly_subscribe():
    """
    Удаляет подписки у которых больше нету подписчиков.
    :param notif_ids: id объектов которые требуется удалить.
    :return:
    """
    _lonely_subscribers = DBSession.query(NotificationSubscribe).\
        outerjoin(
            NotificationSubscribeEmail,
            NotificationSubscribe.id == NotificationSubscribeEmail.notification_subscribe_id
        ).filter(
            NotificationSubscribeEmail.notification_subscribe_id == None
        ).all()

    lonely = []
    for obj in _lonely_subscribers:
        lonely.append(obj.feature_id)
        DBSession.delete(obj)
    return lonely


# TODO
#  1 - проверка на числа а не строки в feature_ids
def update_subscribe(resource, request):
    """
    Обновление подписки пользователей на изменение объекта.
    """
    # получаем json параметры
    resource_id = request.json.get("resource_id", None)
    feature_ids = set(request.json.get("feature_ids", None))
    email_id = request.json.get("email_id", None)

    # проверка resource и email на существование
    try:
        email = DBSession.query(NotificationEmail).filter_by(id=email_id).one()
        resource = Resource.filter_by(id=resource_id).one()
    except NoResultFound:
        return dict(error="Resource or Email not found", resource_id=resource_id, email=email_id)

    # отписка email от всех объектов
    if not feature_ids:
        result = unsubscribe(email=email, resource=resource)
        return dict(succses='Update subscribe')

    # TODO ! протестировать !
    # id объектов текущего ресурса
    id_feat_of_res = {item[0] for item in
                      DBSession.query(NotificationSubscribe.feature_id).
                      filter_by(resource_id=resource.id)}

    # TODO не хватает валидации на ресурс
    # все объекты подписанные на текущий email
    _links = DBSession.query(NotificationSubscribeEmail.notification_subscribe_id).filter(
        NotificationSubscribeEmail.notification_email_id==email.id)
    _subscr = DBSession.query(NotificationSubscribe.feature_id).filter(
        NotificationSubscribe.id.in_([item[0] for item in _links]))
    feature_of_current_email = {item.feature_id for item in _subscr.all()}

    # объекты существуют, требуется только подписаться
    _exist = (id_feat_of_res & feature_ids) - feature_of_current_email
    # объекты от которых надо отписаться
    _delete = feature_of_current_email - feature_ids
    # объекты требуется создать и подписаться
    _create = feature_ids - id_feat_of_res

    # подписка на уже существующие объекты
    if _exist:
        _new_subscruber = list()
        _notif = DBSession.query(NotificationSubscribe).\
            filter(NotificationSubscribe.feature_id.in_(_exist))
        for item in _notif:
            _new_subscruber.append(
                NotificationSubscribeEmail(
                    notification_email_id=email.id, notification_subscribe_id=item.id))
        DBSession.add_all(_new_subscruber)

    # создание новых объектов и подписка на них
    if _create:
        create_subscribe(email=email, resource=resource, create=_create)

    # отписываемся от объектов
    if _delete:
        unsubscribe(email=email, resource=resource, delete=_delete)

    return dict(success="Update subscribe.")

# TODO :
#  1 - resource_permission
def check_change(resource, request):
    """
    Вычисляет изменился ли хэш объектов.
    Для каждого и подписчиков группируем все его подписки и вычисляем не изменился ли их хеш.
    :return:
    """
    emails = DBSession.query(NotificationEmail).all()
    result = dict()

    # проходимся по всем подписчикам
    if emails:
        for email in emails:

            # все подписки текущего email
            _links = DBSession.query(NotificationSubscribeEmail.notification_subscribe_id)\
                .filter_by(
                    notification_email_id=email.id
                ).all()
            objs = DBSession.query(NotificationSubscribe)\
                .filter(
                    NotificationSubscribe.id.in_([item[0] for item in _links])
                ).all()

            # если для email нет подписок пропускаем цикл
            if not objs:
                continue
            result[email] = dict()

            try:
                # группируем объекты по ресурсам
                basket = {item.resource_id: dict() for item in objs}
                for feature in objs:
                    if feature.resource_id in basket.keys():
                        basket[feature.resource_id][feature.feature_id] = feature

                empty = True
                # проходимся по каждому из ресурсов для email
                for res_id, notif in basket.items():
                    # получаем ресурс и его объекты
                    resource = Resource.filter_by(id=res_id).one()
                    query = resource.feature_query()
                    query.filter(["id", "in", ",".join(map(str, notif.keys()))])

                    # проверка изменения объекта по хешу
                    result[email][resource] = list()
                    for feature in query():
                        new_hash = get_feature_hash_sha1(feature)

                        # если объект изменился добавляем его для извещания подписчика
                        if notif[feature.id].hash != new_hash:
                            result[email][resource].append(feature)  # добавляем объект для отправки по email
                            notif[feature.id].hash = new_hash # перезаписываем хеш в объект подписки
                            empty = False

                # если совсем никаких изменений нету то но будем отправлять извещание
                if empty:
                    del result[email]

            except Exception as e:
                raise e

    else:
        # TODO как логировать в NGW
        print('Нет подписчиков')

    # отправка почты
    if result:
        for email, objects in result.items():
            send_email(email=email, objects=objects)

    return dict(result='')


def send_email(email, objects):
    """
    Отправка извещения подписчику об изменении объектов.
    :param email: NotificationEmail - Email для отправки сообщения.
    :param objects: dict - {Resource: list(Feature, Feature ...)} ресурс с объектами слоя.
    :return:
    """
    # TODO тут отправка сообщений на Email
    pass


def get_feature_hash_sha1(feature):
    """
    Получает хэш объекта алгоритмом SHA1
    :param feature: PostgisLayer - объект слоя.
    :return: str - хэш объекта.
    """
    # строковое представление всех полей объекта
    summ = "".join(map(str, feature.fields.values()))

    # получаем хэш, алгоритмом SHA1
    hex_dig = hashlib.sha1(str.encode(summ)).hexdigest()
    return hex_dig


def notification_subscriber_store(request):
    # request.resource_permission(PD_READ)
    return dict()


def setup_pyramid(comp, config):
    """API route"""

    # NotificationSubscribe
    config.add_route('notification.subscriber', r'/api/notification/')\
        .add_view(get_all_notification, request_method='GET', renderer='json') \
        .add_view(update_subscribe, request_method='POST', renderer='json')

    # NotificationEmail
    config.add_route('notification.email', r'/api/notification/email/')\
        .add_view(get_all_notification_email, request_method='GET', renderer='json')\
        .add_view(create_notification_email, request_method='POST', renderer='json')

    # Get Notification field
    config.add_route('notification.field', r'/api/notification/field/')\
        .add_view(field_collection, request_method='GET', renderer='json')

    config.add_route('notification.subscriber.collection', r'/api/notification/subscriber/collection/')\
        .add_view(subscriber_collection, request_method='GET', renderer='json')


    # config.add_route('notification_email.item', r'/api/notification_email/{id}') \
    #     .add_view(delete_notification_email, request_method='DELETE', renderer='json')

    # config.add_route(
    #     'notification.subscriber.store', r'api/notification/subscribers/'
    # ).add_view(notification_subscriber_store,  request_method='GET', renderer='json')

    # TODO тестовыая точка API удалить потом
    config.add_route('check_change', r'/api/check_change')\
        .add_view(check_change, request_method='POST', renderer='json')

    config.add_route('resource.description', r'/api/resource/description/')\
        .add_view(get_resource_desc, request_method='GET', renderer='json')
