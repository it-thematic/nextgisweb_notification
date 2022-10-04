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
    "ngw-feature-layer/FeatureGrid",
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
    FeatureGrid
) {

    /** Расширяем класс управления таблицей объектов ресурса */
    var FeatureGridNotif = declare([FeatureGrid], {
        // Объекты для выделения при инициализации объекта
        initialSelectRow: null,

        // templateString: i18n.renderTemplate(testtemplate),

        // добавляем объекты, что должны быть выделены в таблице с самого начала
        startup: function () {
            this.inherited(arguments);

            var widget = this;
            this._gridInitialized.then(
                function () {
                    widget.gridPane.set("content", widget._grid.domNode);
                    widget._grid.startup();
                    return widget;
                }
            ).then(
                function (widget) {
                    if (widget.initialSelectRow) {
                        for (var key in widget.initialSelectRow) {
                            widget._grid.select(widget._grid.row(widget.initialSelectRow[key]))
                        }
                    }
                }
            );
            this.btnFilter.iconNode.setAttribute('data-icon', 'filter_alt');
        },

        postCreate: function () {
            this.inherited(arguments);
            domStyle.set(this.btnOpenFeature.domNode, 'display', 'none');
            domStyle.set(this.btnUpdateFeature.domNode, 'display', 'none');
            domStyle.set(this.btnDeleteFeature.domNode, 'display', 'none');
        },

    });


    /** Класс с логикой обработки таблицы */
    return declare(Dialog, {

        constructor: function (options) {
            declare.safeMixin(this, options);
            this.widget = options.widget
            this._data = options.row
            this.title = options.row.data.resource;
        },

        buildRendering: function () {
            this.inherited(arguments);

            this.mainContainer = new ContentPane({
                style: "width: 1000px; height: 500px; padding: 0; max-height:500px"
                // style: "width: 100%; height: 100%; padding: 0"
            }).placeAt(this.containerNode);

            // создание таблицы
            this._grid = new FeatureGridNotif({
                style: "width: 100%; height: 100%; padding: 0",
                initialSelectRow: this._data.data.features,
                layerId: this._data.data.resource_id,
                readonly: true
            })
            this._grid.placeAt(this.mainContainer);
            this._grid.startup();

            // создание нижнего бара для кнопок
            this.actionBarDown = domConstruct.create("div", {class: "dijitDialogPaneActionBar"}, this.containerNode);

            // очистка всех объектов
            this.btnClean = new Button({
                label: i18n.gettext("Clean"),
                onClick: lang.hitch(this, this.clean),
                style: 'display: inline-block'
            }).placeAt(this.actionBarDown);

            // подписка на выделенные объекты
            this.btnOk = new Button({
                label: i18n.gettext("Apply"),
                onClick: lang.hitch(this, this.save),
                style: 'display: inline-block'
            }).placeAt(this.actionBarDown);

            // выход
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
                // TODO проверку features email
                var request = {
                    resource_id: this._data.data.resource_id,
                    feature_ids: features,
                    email_id: this._data.data.email_id
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


