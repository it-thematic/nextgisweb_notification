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
    "dojo/store/Memory",
    "dojo/store/Observable",
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
    "./SubscribeWindow"
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
    Memory,
    Observable,
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

        /** ?????????????? ???????????????????? */
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
                // selector({label: "", selectorType: "checkbox", width: 10, unhidable: true}),
                {field: "email", label: "Email", unhidable: true, sortable: true, width: 30},
                {field: "resource", label: "????????????", unhidable: true, sortable: true, width: 30},
                {field: "features_label", label: "??????????????", unhidable: true, sortable: true, width: 150}
            ];

            // ???????????????? ??????????????
            this._grid = new GridClass({
                columns: columns
            });
            this._grid.renderArray(this._data);

            domStyle.set(this._grid.domNode, "height", "100%");
            domStyle.set(this._grid.domNode, "border", "none");

            // ???????????????????? ????????????????
            this._grid.on(".dgrid-row:dblclick", lang.hitch(this, this._onUpdateSubscribe));

            // ???????????????? ???????????? ?? ??????????????
            this._grid.on("dgrid-select", lang.hitch(this, this._selectRow));

            // ???????????????? ?????????? ????????????????
            this.btnCreateSubscribe.on("click", lang.hitch(this, this._onCreate));

            // ???????????????? ????????????????
            this.btnDeleteSubscribe.on("click", lang.hitch(this, this._onDelete));

            this._gridInitialized.resolve();
        },

        /** ???????????????? ???????????? ?? ?????????????? */
        _selectRow: function (event){
            this.currentSelectRows = event.rows[0].data
        },

        /** ???????????????? ???????????????? */
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

        /** ???????????? ???????????????? ?????????? ???????????????? */
        _onCreate: function (event){
            this.SubscribeWindow = new SubscribeWindow({
                createNew: true,
                widget: this
            });
            this.SubscribeWindow.show();
        },

        /** ???????????? ???????????????????? ???????????????????????? ???????????????? */
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

            // ?????????????????? ???????????? ?? ??????????????
            this.btnCreateSubscribe.iconNode.setAttribute('data-icon', 'open_in_new');
            this.btnDeleteSubscribe.iconNode.setAttribute('data-icon', 'delete');
        },
    });

});
