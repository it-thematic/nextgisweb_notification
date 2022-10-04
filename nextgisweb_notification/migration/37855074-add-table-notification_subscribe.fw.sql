/*** {
    "revision": "37855074", "parents": ["00000000"],
    "date": "2022-08-04T13:37:46",
    "message": "Add table notification_subscribe"
} ***/

CREATE TABLE public.notification_subscribe
(
    id serial4 NOT NULL,
    resource_id int4 NOT NULL,
    feature_id int4 NOT NULL,
    last_change timestamptz NOT NULL,
    hash text NOT NULL,
    CONSTRAINT notification_subscribe_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notification_email
(
    id serial4 NOT NULL,
    email character varying(100) NOT NULL,
    CONSTRAINT notification_email_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notification_subscribe_email
(
    id serial4 NOT NULL,
    notification_subscribe_id int4 NOT NULL,
    notification_email_id int4 NOT NULL,

    CONSTRAINT notification_subscribe_email_pkey PRIMARY KEY (id),

    CONSTRAINT notification_subscribe_email_notification_subscribe_id_fkey
        FOREIGN KEY (notification_subscribe_id) REFERENCES public.notification_subscribe (id),

    CONSTRAINT notification_subscribe_email_notification_email_id_fkey
        FOREIGN KEY (notification_email_id) REFERENCES public.notification_email (id)
);

COMMENT ON TABLE notification_subscribe_email IS 'notification';
COMMENT ON TABLE notification_subscribe IS 'notification';
COMMENT ON TABLE notification_email IS 'notification';
