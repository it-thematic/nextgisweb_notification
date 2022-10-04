# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from nextgisweb.resource import DataScope
from nextgisweb.pyramid import viewargs
from .util import _
from nextgisweb import dynmenu as dm


PD_READ = DataScope.read
PD_WRITE = DataScope.write


@viewargs(renderer='nextgisweb_notification:template/notifications.mako')
def email_notifications(request):
    # request.resource_permission(PD_READ)
    return dict(
        obj=request.context,
        title=_("Email notifications"),
        maxwidth=True,
        maxheight=True
    )


def setup_pyramid(comp, config):
    # создаем роут подключаем к нему представление
    config.add_route(
        'notification', '/notification/'
    ).add_view(email_notifications)

    # add link in admin panel
    comp.env.pyramid.control_panel.add(
        dm.Label('notification', _("Notification")),
        dm.Link('notification', _("Subscribe for notification"),
                lambda args: (
                    args.request.route_url('notification'))
                )
    )
