# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from nextgisweb.component import Component, require

from .model import Base
from .util import COMP_ID

from pyramid_mailer.mailer import Mailer

from nextgisweb.lib.config import Option, OptionAnnotations


class NotificationComponent(Component):
    identity = COMP_ID
    metadata = Base.metadata

    @require('resource')
    def setup_pyramid(self, config):

        # settings for mailer
        email_settings = {
            'mail.host': self.options['mail.host'],
            'mail.port': self.options['mail.port'],
            'mail.username': self.options['mail.username'],
            'mail.password': self.options['mail.password'],
            'mail.tls': self.options['mail.tls'],
            'mail.ssl': self.options['mail.ssl']
        }
        config.registry['mailer'] = Mailer.from_settings(email_settings)

        from . import view, api
        view.setup_pyramid(self, config)
        api.setup_pyramid(self, config)

    option_annotations = OptionAnnotations((
        Option('mail.host', str, default="", doc="Host for mailer"),
        Option('mail.port', int, default="", doc="Port for smtp server"),
        Option('mail.username', str, default="", doc="Email for smtp server"),
        Option('mail.password', str, default="", doc="Password for smtp server"),
        Option('mail.tls', bool, default="", doc=""),
        Option('mail.ssl', bool, default="", doc=""),
    ))

def pkginfo():
    return dict(components=dict(
        notification='nextgisweb_notification'))


def amd_packages():
    return (
        ('ngw-notification', 'nextgisweb_notification:amd/ngw-notification'),
    )
