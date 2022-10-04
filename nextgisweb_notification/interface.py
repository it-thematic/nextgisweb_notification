from zope.interface import Interface, Attribute


class INotification(Interface):
    get_all = Attribute(""" List of all instance """)
