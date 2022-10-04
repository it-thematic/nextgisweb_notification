define([
    "dojo/_base/declare",
    "dijit/layout/BorderContainer",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/Dialog",
    "dijit/ConfirmDialog",
    "dojo/text!./template/NotificationGrid.hbs",
    // dgrid & plugins
    "dgrid/OnDemandGrid",
    "dgrid/Selection",
    "dgrid/selector",
    "dgrid/extensions/ColumnHider",
    "dgrid/extensions/ColumnResizer",
    "dgrid/Grid",
    "dgrid/Keyboard",
    // other
    "dojo/domReady!",
    "dojo/data/ItemFileWriteStore",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/store/Observable",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/json",
    "dojo/topic",
    // ngw
    "openlayers/ol",
    "@nextgisweb/pyramid/api",
    "@nextgisweb/pyramid/i18n!",
    "ngw-lookup-table/cached",
    "ngw-feature-layer/FeatureStore",
    "./NotificationStore",
    // template
    "dijit/layout/ContentPane",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/form/TextBox",
    "dijit/form/CheckBox",
    "./SubscribeWindow",
    "./CreateWindow"
], function (
    declare,
    BorderContainer,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Dialog,
    ConfirmDialog,
    // hbs templates
    template,
    // dgrid & plugins
    OnDemandGrid,
    Selection,
    selector,
    ColumnHider,
    ColumnResizer,
    Grid,
    Keyboard,
    domReady,
    // other
    ItemFileWriteStore,
    lang,
    array,
    Deferred,
    all,
    Observable,
    domStyle,
    domClass,
    json,
    topic,
    // ngw
    ol,
    api,
    i18n,
    lookupTableCached,
    FeatureStore,
    NotificationStore,
    ContentPane,
    Toolbar,
    Button,
    TextBox,
    CheckBox,
    SubscribeWindow,
    CreateWindow
) {

    // TODO оптимизировать // var GridClass = declare([Grid, Selection], {
    var GridClass = declare([Grid, Keyboard, Selection], {
            selectionMode: "single",
            allowTextSelection: true,
            minRowsPerPage: Infinity,
            deselectOnRefresh: false
        });

    return declare([BorderContainer, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: i18n.renderTemplate(template),
        subscribeWindow: null,
        createWindow: null,

        constructor: function (params) {
            declare.safeMixin(this, params);
            this._gridInitialized = new Deferred();

            var widget = this;
            api.route("notification.subscriber.collection")
                .get()
                .then(function (data) {
                    widget._data = data;
                    widget.initializeGrid()
                });
        },

        initializeGrid: function (){
            var columns = [
                // selector({label: "", selectorType: "checkbox", width: 10, unhidable: true}),
                {field: "email", label: "Email", unhidable: true, sortable: true, width: 30},
                {field: "resource", label: "Ресурс", unhidable: true, sortable: true, width: 30},
                {field: "features", label: "Объекты", unhidable: true, sortable: true, width: 150}
            ];

            // создание таблицы
            this._grid = new GridClass({columns: columns});
            // вносим данные в таблицу
            this._grid.renderArray(this._data);

            domStyle.set(this._grid.domNode, "height", "100%");
            domStyle.set(this._grid.domNode, "border", "none");

            // обновление подписка
            this._grid.on(".dgrid-row:dblclick", lang.hitch(this, this._onUpdateSubscribe));

            // создание новой подписки
            this.btnCreateSubscribe.on("click", lang.hitch(this, this._onCreate));

            // TODO сделать удаление подписки
            // удаление подписки
            this.btnDeleteSubscribe.on("click", lang.hitch(this, this._onDelete));

            this._gridInitialized.resolve();
        },


        // TODO сделать проверку, что такой email и ресурс уже созданы ?
        /** Добавление новой подписки */
        addNewRow: function (data){
            this._data.push(data)
            this._grid.renderArray([data]);
        },

        /** Удаление подписки */
        _onDelete: function (event){
            console.log('_onDelete')
            console.log(event)
        },

        /** Виджет создание новой подписки */
        _onCreate: function (event){
            this.SubscribeWindow = new SubscribeWindow({
                widget: this,
                createNew: true
            });
            this.SubscribeWindow.show();
        },

        /** Виджет обновления существующей подписки */
        _onUpdateSubscribe: function (event){
            var row = this._grid.row(event);
            this.SubscribeWindow = new SubscribeWindow({
                widget: this,
                row: row
            });
            this.SubscribeWindow.show();
        },

        startup: function (){
            this.inherited(arguments);

             var widget = this;
             this._gridInitialized.then(
                function () {
                    widget.gridPane.set("content", widget._grid.domNode);
                    widget._grid.startup();
                }
            );

            // добавляем иконки к кнопкам
            this.btnCreateSubscribe.iconNode.setAttribute('data-icon', 'open_in_new');
            this.btnDeleteSubscribe.iconNode.setAttribute('data-icon', 'delete');
        },

        // save: function (request){
        //     // запрос на обновление подписок
        //     api.route("notification.subscriber")
        //         .post({
        //             json: request
        //         })
        //         .then(function (response) {
        //             console.log('response')
        //             console.log(response)
        //         });
        //
        //     var widget = this;
        //     api.route("notification.subscriber.collection")
        //         .get()
        //         .then(function (data) {
        //             widget._data = data;
        //             return widget
        //         }).then(function (widget) {
        //             widget._grid.store = widget._data;
        //             widget._grid.refresh();
        //         })
        // }

    });

});







