define([
    "dojo/_base/declare",
    "dijit/layout/BorderContainer",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!./template/NotificationGrid.hbs",
    // dgrid & plugins
    "dgrid/Selection",
    "dgrid/selector",
    "dgrid/Grid",
    "dgrid/Keyboard",
    // other
    "dojo/domReady!",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/json",
    "dojo/topic",
    // ngw
    "openlayers/ol",
    "@nextgisweb/pyramid/api",
    "@nextgisweb/pyramid/i18n!",
    // template
    "dijit/form/CheckBox",
    "./SubscribeWindow"
], function (
    declare,
    BorderContainer,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    // hbs templates
    template,
    // dgrid & plugins
    Selection,
    selector,
    Grid,
    Keyboard,
    domReady,
    // other
    lang,
    array,
    Deferred,
    all,
    domStyle,
    domClass,
    json,
    topic,
    // ngw
    ol,
    api,
    i18n,
    CheckBox,
    SubscribeWindow
) {

    var GridClass = declare([Grid, Keyboard, Selection], {
            selectionMode: "single",
            allowTextSelection: true,
            minRowsPerPage: Infinity,
            deselectOnRefresh: false
        });

    return declare([BorderContainer, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: i18n.renderTemplate(template),
        subscribeWindow: null,
        currentSelectRows: null,

        constructor: function (params) {
            declare.safeMixin(this, params);
            this._gridInitialized = new Deferred();

            var widget = this;
            api.route("notification.subscriber.collection")
                .get()
                .then(function (responses) {
                    if(responses) {
                        widget._data = widget._get_title(responses.data);
                        widget.initializeGrid();
                    }
                });
        },

        /** Обрезка заголовков */
        _get_title: function (data) {
            data.forEach((item) => {
                var title = item.features_label.join();
                if (title.length > 100){
                    item.features_label = title.substring(0, 100) + '...';
                }
            })
            return data
        },

        initializeGrid: function (){
            var columns = [
                {field: "email", label: "Email", unhidable: true, sortable: true, width: 30},
                {field: "resource", label: "Ресурс", unhidable: true, sortable: true, width: 30},
                {field: "features_label", label: "Объекты", unhidable: true, sortable: true, width: 150}
            ];

            // создание таблицы
            this._grid = new GridClass({
                columns: columns
            });
            this._grid.renderArray(this._data);

            domStyle.set(this._grid.domNode, "height", "100%");
            domStyle.set(this._grid.domNode, "border", "none");

            // обновление подписка
            this._grid.on(".dgrid-row:dblclick", lang.hitch(this, this._onUpdateSubscribe));

            // выделяем строку в таблице
            this._grid.on("dgrid-select", lang.hitch(this, this._selectRow));

            // создание новой подписки
            this.btnCreateSubscribe.on("click", lang.hitch(this, this._onCreate));

            // удаление подписки
            this.btnDeleteSubscribe.on("click", lang.hitch(this, this._onDelete));

            this._gridInitialized.resolve();
        },

        /** выделяем строку в таблице */
        _selectRow: function (event){
            this.currentSelectRows = event.rows[0].data
        },

        /** Удаление подписки */
        _onDelete: function (event){
            var request = {
                resource_id: this.currentSelectRows.resource_id,
                email_id: this.currentSelectRows.email_id,
                feature_ids: []
            }

            var widget = this;
            api.route("notification.subscriber")
                .post({json: request})
                .then(function (response) {
                    console.log(response)
                    widget._updateGrid()
                });
        },

        _updateGrid: function (){
            var widget = this
            api.route("notification.subscriber.collection")
                .get()
                .then(function (response) {
                    if (response.data) {
                        widget._data = widget._get_title(response.data);
                        widget._grid.refresh()
                        widget._grid.clearSelection();
                        widget._grid.renderArray(response.data);
                    }
                });
        },

        /** Виджет создание новой подписки */
        _onCreate: function (event){
            this.SubscribeWindow = new SubscribeWindow({
                createNew: true,
                widget: this
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
    });

});
