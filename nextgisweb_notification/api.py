# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import hashlib
import re

from pyramid_mailer.message import Message
from sqlalchemy import func
from sqlalchemy.orm.exc import NoResultFound

from nextgisweb.lib.logging import logger
from nextgisweb.models import DBSession
from nextgisweb.resource import Resource, DataScope
from .model import NotificationSubscribeEmail, NotificationSubscribe, NotificationEmail

# права для доступа
PERM_READ = DataScope.read
PERM_WRITE = DataScope.write


# TODO
#  1) FeatureLayer 2) точка апи со списком всех слоев в нгв
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
            Resource.cls.in_(['postgis_layer', 'vector_layer']))

    if _query:
        data = _query.filter(Resource.id.in_(res_ids)).all() if res_ids else _query.all()
        return dict(success=True, data=[elem._asdict() for elem in data])

    return dict(success=True, data=[])

# TODO что если подписок не существует, ввести проверку
def subscriber_collection(resource, request):
    """
    Возвращает сгруппированные подписки на объекты русурса по email.
    Формат возвращаемых данных: [
        {
             features: [1, 2],
             resource_id: 10,
             resource: 'Resource name',
             email_id: 13,
             email: 'email@yandex.ru',
             features_label: ['#1', '#2']
        }, ....
    ]
    """
    # группируем email, ресурсы и принадлежащие им объекты
    data = DBSession.query(
            func.array_agg(NotificationSubscribe.feature_id).label('features'),
            NotificationSubscribe.resource_id.label('resource_id'),
            Resource.display_name.label('resource'),
            NotificationEmail.id.label('email_id'),
            NotificationEmail.email.label('email')
        )\
        .filter(
            NotificationSubscribeEmail.notification_subscribe_id == NotificationSubscribe.id,
            NotificationSubscribeEmail.notification_email_id == NotificationEmail.id)\
        .filter(
            Resource.id == NotificationSubscribe.resource_id).\
        group_by(
            NotificationSubscribe.resource_id,
            NotificationEmail.id,
            Resource.id).\
        all()

    if not data:
        return dict(success=False, data=[])

    # получаем сгруппированные данные в виде словарей
    result = [elem._asdict() for elem in data]

    # получаем наименования объектов
    for row in result:
        query = Resource.filter_by(id=row['resource_id']).one().feature_query()
        query.filter(["id", "in", ",".join(map(str, row['features']))])
        row['features_label'] = [feature.label for feature in query()]
    return dict(success=True, data=result)


def get_all_notification_email(resource, request):
    emails = NotificationEmail().get_all()
    if emails:
        return dict(success=True, data=emails)
    return dict(success=True, data=[])


def create_notification_email(resource, request):
    """
    Создать нового подписчика.
    """
    email = request.json.get('email', None)
    regx = r"^[\w\.\+\-]+\@[\w]+\.[a-z]{2,3}$"

    # создание ного подписчика
    if email and bool(re.search(regx, email)):
        new_email = NotificationEmail(email=email)
        DBSession.add(new_email)
        DBSession.flush()
        return dict(succsess=True,
                    message='Succsess create',
                    data={'id':new_email.id})

    return dict(success=False, message="Email not valid.")

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
    Отписываем Email от подписки на уведомления.
    Удаляет либо все либо указанные подписки на конкретный ресурс.
    :param email: NotificationEmail - объект подпискича на события.
    :param resource: Resource - объект ресурса.
    :param delete: list() - список с id объектов ресурса для отписки
    :return: int колличество удаленных подписок
    """
    try:
        # отписываем подписчика либо от всех объектов либо только от указанных
        if delete:
            _feat_of_res = DBSession.query(
                    NotificationSubscribe.id).\
                filter(
                    NotificationSubscribe.feature_id.in_(delete),
                    NotificationSubscribe.resource_id == resource.id)
        else:
            _feat_of_res = DBSession.query(
                    NotificationSubscribe.id).\
                filter_by(
                    resource_id=resource.id)

        # получаем объекты для отписки
        _links = DBSession.query(
                NotificationSubscribeEmail).\
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
        return dict(success=False,
                    message="Resource or Email not found",
                    data={"resource_id":resource_id, "email_id":email_id})

    # проверка объектов
    if not all(isinstance(id, int) for id in feature_ids):
        return dict(success=False,
                    data={"feature_ids":feature_ids},
                    message="Features must be integer type")

    # отписка email от всех объектов
    if not feature_ids:
        del_count = unsubscribe(email=email, resource=resource)
        return dict(succses=True, message='Update subscribe')

    # id объектов текущего ресурса
    id_feat_of_res = {item[0] for item in
                      DBSession.query(
                          NotificationSubscribe.feature_id).
                      filter_by(
                          resource_id=resource.id)
                      }

    # все объекты подписанные на текущий email
    _links = DBSession.query(
            NotificationSubscribeEmail.notification_subscribe_id).\
        filter(
            NotificationSubscribeEmail.notification_email_id==email.id)

    _subscr = DBSession.query(NotificationSubscribe.feature_id).\
        filter(
            NotificationSubscribe.id.in_([item[0] for item in _links])).\
        filter(
            NotificationSubscribe.resource_id == resource_id)

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
        _notif = DBSession.query(
                NotificationSubscribe).\
            filter(
                NotificationSubscribe.feature_id.in_(_exist),
                NotificationSubscribe.resource_id == resource_id
        )
        for item in _notif:
            _new_subscruber.append(
                NotificationSubscribeEmail(
                    notification_email_id=email.id, notification_subscribe_id=item.id)
            )
        DBSession.add_all(_new_subscruber)

    # создание новых объектов и подписка на них
    if _create:
        create_subscribe(email=email, resource=resource, create=_create)

    # отписываемся от объектов
    if _delete:
        unsubscribe(email=email, resource=resource, delete=_delete)

    return dict(success=True, message="Update subscribe")


# TODO :
#  1 - resource_permission
def check_features_change(resource, request):
    """
    Вычисляет изменился ли хэш объектов.
    Для каждого и подписчиков группируем все его подписки и вычисляем не изменился ли их хеш.
    """
    result, emails = dict(), DBSession.query(NotificationEmail).all()

    if not emails:
        return dict(success=False, message='No email for sent')

    logger.info("Идет подготовка данных...")

    try:
        # проходимся по всем подписчикам
        for email in emails:
            # все подписки текущего email
            _links = DBSession.query(NotificationSubscribeEmail.notification_subscribe_id)\
                .filter_by(
                    notification_email_id=email.id
                ).all()
            # объекты ресурса для проверки на изменение
            objs = DBSession.query(NotificationSubscribe)\
                .filter(
                    NotificationSubscribe.id.in_([item[0] for item in _links])
                ).all()

            # если для email нет подписок пропускаем цикл
            if not objs:
                continue
            result[email] = dict()

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

            # если совсем изменений
            if empty:
                del result[email]

        # отправка почты
        if result:
            logger.info("Отправляю данные по почте...")
            for email, objects in result.items():
                send_email(mailer=request.registry['mailer'],
                           email=email.email,
                           objects={ k: v for k,v in objects.items() if v })
            return dict(success=True, message='The mail has been sent')

    except Exception as e:
        logger.error("Ошибка, при подготовке данных...")
        logger.exception(e)
        return dict(success=False, message='Sent email failure')

    logger.info("Данных для отправки не найдено...")
    return dict(success=True, message='No data available')


def send_email(mailer=None, email=None, objects=None):
    """
    Отправка извещения подписчику об изменении объектов.
    :param email: NotificationEmail - Email для отправки сообщения.
    :param objects: dict - {Resource: list(Feature, Feature ...)} ресурс с объектами слоя.
    :return:
    """

    _body = str()
    for key in objects:
        _body += key.display_name + ': \n'
        for obj in objects[key]:
            _body += f' - {obj.label}\n'

    message = Message(subject="Уведомление об изменениях",
            sender=mailer.smtp_mailer.username,
            recipients=[email],
            body=_body)

    mailer.send_immediately(message, fail_silently=False)
    logger.info("Email успешно отправлены...ok")

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


def setup_pyramid(comp, config):
    """API route"""

    # Create subscribe
    config.add_route('notification.subscriber', r'/api/notification/') \
        .add_view(update_subscribe, request_method='POST', renderer='json')

    # Create email for notification
    config.add_route('notification.email', r'/api/notification/email/')\
        .add_view(get_all_notification_email, request_method='GET', renderer='json')\
        .add_view(create_notification_email, request_method='POST', renderer='json')

    # Getting subscribes grouped by email
    config.add_route('notification.subscriber.collection', r'/api/notification/subscriber/collection/')\
        .add_view(subscriber_collection, request_method='GET', renderer='json')

    # Send email for changing objects
    config.add_route('notification.sender', r'/api/notification/sender/')\
        .add_view(check_features_change, request_method='GET', renderer='json')

    # Get resource description
    config.add_route('resource.description', r'/api/resource/description/')\
        .add_view(get_resource_desc, request_method='GET', renderer='json')
