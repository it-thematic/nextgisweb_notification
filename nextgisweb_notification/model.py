# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import sqlalchemy as db
import datetime

from sqlalchemy.sql import func

from nextgisweb.models import declarative_base
from nextgisweb.models import DBSession
from zope.interface import Interface, implementer

Base = declarative_base()


class BaseNotification:

    def get_all(self):
        """Возвращает все записи модели"""
        query = db.select(self.__class__)
        all_fields = DBSession.connection().execute(query).all()

        result = list()
        for fld in all_fields:
            result.append(dict(zip(fld._fields, fld._data)))

        return result


@implementer(Interface)
class NotificationSubscribe(Base, BaseNotification):
    """Подписка на изменение объектов слоя."""
    __tablename__ = 'notification_subscribe'

    id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, nullable=False)
    feature_id = db.Column(db.Integer, nullable=False)
    last_change = db.Column(db.DateTime(timezone=True),
                            default=datetime.datetime.utcnow,
                            server_default=func.now(),
                            onupdate=func.now(),
                            nullable=False
                            )
    hash = db.Column(db.Unicode, unique=True, nullable=False)

    identity = __tablename__

    def __str__(self):
        return str(self.id)


# TODO создать описание подписчика
@implementer(Interface)
class NotificationEmail(Base, BaseNotification):
    """Подписчики на уведомления."""
    __tablename__ = 'notification_email'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.Unicode(100), unique=True, nullable=False)

    identity = __tablename__

    def __str__(self):
        return str(self.email)


@implementer(Interface)
class NotificationSubscribeEmail(Base, BaseNotification):
    """Связующая таблица между подписчиками и объектами подписки."""
    __tablename__ = 'notification_subscribe_email'

    id = db.Column(db.Integer, primary_key=True)

    notification_subscribe_id = \
        db.Column(db.Integer, db.ForeignKey('notification_subscribe.id'))

    notification_email_id = \
        db.Column(db.Integer, db.ForeignKey('notification_email.id'))

    # children = relationship("Child",
    #                         cascade="all,delete",
    #                         backref="parent"
    #                         )

    identity = __tablename__

    def __str__(self):
        return str(self.id)


# ===============================================
# ============= Сигналы для моделей =============
# ===============================================
# @event.listens_for(DBSession, 'before_commit')
# def receive_before_commit(session):
#     print("before commit!")


# def my_before_commit(session):
#     print("before commit!")
#
#
# event.listen(DBSession, "before_commit", my_before_commit)

# @event.listens_for(DBSession, 'before_commit')
# def receive_after_attach(session, instance):
#     print("before commit!")

