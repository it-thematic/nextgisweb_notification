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
    "dojo/dom-construct",
    "dojo/promise/all",
    "dojo/store/Memory",
    "dojo/on",
    "dojo/touch",
    'dojo/request/xhr',
    "dojo/dom-style",
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
    "./FeatureGridNotif"
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
    domConstruct,
    all,
    Memory,
    on,
    touch,
    xhr,
    domStyle,
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

    /** Класс с логикой обработки таблицы */
    return declare(Dialog, {

        createNew: false,

        constructor: function (options) {
            declare.safeMixin(this, options);
            this.widget = options.widget
            this._data = options.row
            this.title = this.createNew ? 'Создание новой подписки' : options.row.data.resource ;
        },

        buildRendering: function () {
            this.inherited(arguments);

            // главный контейнер
            this.mainContainer = new ContentPane({style: "width: 1000px; height: 500px; padding: 0; max-height:500px"}).placeAt(this.containerNode);

            // создание таблицы
            this._grid = new FeatureGridNotif({
                style: "width: 100%; height: 100%; padding: 0",
                initialSelectRow: this.createNew ? null : this._data.data.features,
                layerId: this.createNew ? null : this._data.data.resource_id,
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

        // очистка от всех подписок от ресурса
        clean: function () {
            var request = {
                    resource_id: this._data.data.resource_id,
                    feature_ids: [],
                    email_id: this._data.data.email_id
                }
            api.route("notification.subscriber")
                .post({
                    json: request
                })
                .then(function (response) {
                    console.log(response)
                });
        },

        // проверка не изменились ли объекты для подписки
        equalArrays: function(a, b) {
            return !(a.sort() > b.sort() || a.sort() < b.sort());
        },

        // подписка на изменения объектов ресурса
        save: function () {
            // получаем выделенные объекты
            var features = Object.keys(this._grid._grid.selection).map(Number);

            // если в подписки внесены изменения
            if (!this.equalArrays(this._data.data.features, features)) {
                var request = {
                    resource_id: this._data.data.resource_id,
                    email_id: this._data.data.email_id,
                    feature_ids: features
                }

                // this.widget.save(request)
                // запрос на обновление подписок
                api.route("notification.subscriber")
                    .post({
                        json: request
                    })
                    .then(function (response) {
                        console.log(response)
                    });
            }

            this.hide()
        },

    });

});


