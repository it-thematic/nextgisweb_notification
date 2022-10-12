define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dijit/_Widget",
    "dgrid/OnDemandGrid",
    "dgrid/Selection",
    "dgrid/selector",
    "dojo/text!./template/NotificationGrid.hbs",
    "dgrid/extensions/ColumnHider",
    "dgrid/extensions/ColumnResizer",
    "dojo/Deferred",
    "dojo/_base/array",
    "dojo/dom-construct",
    "dojo/promise/all",
    "dojo/store/Memory",
    "dojo/on",
    "dojo/touch",
    'dojo/request/xhr',
    "dojo/dom-style",
    "dojo/dom-class",
    "dijit/layout/ContentPane",
    "dojox/layout/TableContainer",
    "dijit/Dialog",
    "dijit/form/TextBox",
    "dijit/form/NumberTextBox",
    "dijit/form/DateTextBox",
    "dijit/form/Button",
    "dijit/form/Select",
    "dijit/form/FilteringSelect",
    "dijit/form/MultiSelect",
    "@nextgisweb/pyramid/api",
    "@nextgisweb/pyramid/i18n!",
    "@nextgisweb/gui/error",
    "./FeatureGridNotif",
    "xstyle/css!./resource/Widget.css"
], function (
    declare,
    lang,
    _Widget,
    OnDemandGrid,
    Selection,
    selector,
    template,
    ColumnHider,
    ColumnResizer,
    Deferred,
    array,
    domConstruct,
    all,
    Memory,
    on,
    touch,
    xhr,
    domStyle,
    domClass,
    ContentPane,
    TableContainer,
    Dialog,
    // eslint-disable-next-line no-unused-vars
    TextBox,
    NumberTextBox,
    DateTextBox,
    Button,
    Select,
    FilteringSelect,
    MultiSelect,
    api,
    i18n,
    error,
    FeatureGridNotif
) {


    return declare(Dialog, {

        createNew: false,

        constructor: function (options) {
            declare.safeMixin(this, options);
            this.title = this.createNew ? 'Создание новой подписки' : options.row.data.resource;
            this.widget = options.widget;
            this._data = options.row;
        },

        buildRendering: function () {
            this.inherited(arguments);

            // главный контейнер
            this.mainContainer = new ContentPane({style: "width: 1000px; height: 500px; padding: 0; max-height:500px"}).placeAt(this.containerNode);

            // создание таблицы
            this._grid = new FeatureGridNotif({
                initialSelectRow: this.createNew ? null : this._data.data.features,
                layerId: this.createNew ? null : this._data.data.resource_id,
                style: "width: 100%; height: 100%; padding: 0",
                createNew: this.createNew
            })
            this._grid.placeAt(this.mainContainer);
            this._grid.startup();

            // создание нижнего бара для кнопок
            this.actionBarDown = domConstruct.create("div", {class: "dijitDialogPaneActionBar"}, this.containerNode);
            // кнопки нижнего бара
            this.btnClean = new Button({
                label: i18n.gettext("Clean"),
                onClick: lang.hitch(this, this.clean),
                style: 'display: inline-block'
            }).placeAt(this.actionBarDown);
            this.btnOk = new Button({
                label: i18n.gettext("Apply"),
                onClick: lang.hitch(this, this.save),
                style: 'display: inline-block'
            }).placeAt(this.actionBarDown);
            this.btnHide = new Button({
                label: i18n.gettext("Cancel"),
                onClick: lang.hitch(this, this.hide),
                style: 'display: inline-block'
            }).placeAt(this.actionBarDown);
        },

        /**
         * Очистка от всех подписок от ресурса
         */
        clean: function () {
            var request = {
                    resource_id: this._data.data.resource_id,
                    email_id: this._data.data.email_id,
                    feature_ids: []
                }
            api.route("notification.subscriber")
                .post({json: request})
                .then(function (response) {
                    console.log(response)
                });
        },

        /**
         * проверка не изменились ли объекты для подписки
         */
        equalArrays: function(a, b) {
            return !(a.sort() > b.sort() || a.sort() < b.sort());
        },


        /**
         * Проверка email на валидность
         */
        checkEmail: function (email){
            var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            return re.test(email)
        },

        /**
         * Подписка на изменения объектов ресурса
         */
        save: function () {

            var features = Object.keys(this._grid._grid.selection).map(Number);
            features = features.filter(function (value) {
                return !Number.isNaN(value);
            });

            // создаем новую подписку или обновляем старую
            if (this.createNew){
                var resource_id = this._grid.btnResourceStore.item.id;
                var email_id = null

                // подписка на уже существующий email
                if (this._grid.btnEmailStore.item){
                     email_id = this._grid.btnEmailStore.item.id;
                     var createNotif = true;
                     array.forEach(this.widget._data, function (f){
                         if (f.resource_id == email_id && f.email_id == resource_id){
                             createNotif = false;}
                     })
                    if (createNotif) {
                        this.notificatonUpdate({resource_id: resource_id, email_id: email_id, feature_ids: features})
                    }
                // подписка на новый созданный email
                }else if (this._grid.btnEmailStore.value){
                    var email = this._grid.btnEmailStore.value

                    // создание нового email
                    if (this.checkEmail(email)) {
                        var request = {email: email};
                        var widget = this;
                        domClass.remove(this._grid.btnEmailStore.domNode, 'validateError');
                        api.route("notification.email")
                            .post({json: request})
                            .then(function (response) {
                                widget.notificatonUpdate({email_id: response.data.id, resource_id: resource_id, feature_ids: features})
                            })
                    }else {
                        domClass.add(this._grid.btnEmailStore.domNode, 'validateError');
                        return null
                    }
                }
            }else {
                // если в подписки внесены изменения
                if (!this.equalArrays(this._data.data.features, features)) {
                    var request = {
                        resource_id: this._data.data.resource_id,
                        email_id: this._data.data.email_id,
                        feature_ids: features
                    }
                    // обновляем подписку
                    api.route("notification.subscriber")
                        .post({json: request})
                        .then(function (response) {
                            console.log(response)
                        });
                }
            }
            this.hide()
        },

        /**
         * Обновляем подписку
         */
        notificatonUpdate: function (request){
            var widget = this
            api.route("notification.subscriber")
                .post({json: request})
                .then(function (response) {
                    console.log(response);
                    widget.widget._updateGrid();
                });
        }

    });

});


