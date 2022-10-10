import os
import sys

from setuptools import setup, find_packages


version = '1.0'

requires = (
    'nextgisweb',
    'pyramid-mailer==0.15.1'
)

entry_points = {
    'nextgisweb.packages': [
        'nextgisweb_notification = nextgisweb_notification:pkginfo',
    ],

    'nextgisweb.amd_packages': [
        'nextgisweb_notification = nextgisweb_notification:amd_packages',
    ],

}

setup(
    name='nextgisweb_notification',
    version=version,
    description="",
    long_description="",
    classifiers=[],
    keywords='',
    author='',
    author_email='',
    url='',
    license='',
    packages=find_packages(exclude=['ez_setup', 'examples', 'tests']),
    include_package_data=True,
    zip_safe=False,
    install_requires=requires,
    entry_points=entry_points,
)
