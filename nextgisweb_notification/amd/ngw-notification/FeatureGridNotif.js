define([
    "dojo/_base/declare",
    "dijit/layout/BorderContainer",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/Dialog",
    "dijit/ConfirmDialog",
    "ngw-feature-layer/LabelText",
    "dojo/text!./template/FeatureGridNotif.hbs",
    // dgrid & plugins
    "dgrid/OnDemandGrid",
    "dgrid/Selection",
    "dgrid/selector",
    "dgrid/extensions/ColumnHider",
    "dgrid/extensions/ColumnResizer",
    // other
    "dojo/store/Memory",
    "dijit/form/ComboBox",
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
    "dojo/dom-class",
    // 'dojo/dom-construct',
    // ngw
    "openlayers/ol",
    "@nextgisweb/pyramid/api",
    "@nextgisweb/pyramid/i18n!",
    "ngw-lookup-table/cached",
    "ngw-feature-layer/FeatureStore",
    "ngw-feature-layer/SearchWindow",
    // template
    "dijit/layout/ContentPane",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/form/TextBox",
    "dijit/form/CheckBox"
], function (
    declare,
    BorderContainer,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Dialog,
    ConfirmDialog,
    LabelText,
    // hbs templates
    template,
    // dgrid & plugins
    OnDemandGrid,
    Selection,
    selector,
    ColumnHider,
    ColumnResizer,
    // other
    Memory,
    ComboBox,
    domReady,
    ItemFileWriteStore,
    lang,
    array,
    Deferred,
    all,
    Observable,
    domStyle,
    domClass,
    // domConstruct,
    json,
    topic,
    domClass,
    // ngw
    ol,
    api,
    i18n,
    lookupTableCached,
    FeatureStore,
    SearchWindow,
    ContentPane,
    Toolbar,
    Button,
    TextBox,
    CheckBox
) {

    /**
     * Виджет управляет таблицей обьектов на главной странице
     */

    // Base class ggrid which is them wrapped in dijit widget
    var GridClass = declare([OnDemandGrid, Selection, ColumnHider, ColumnResizer, selector], {
            selectionMode: "extended",

            adjustLastColumn: false,

            allowTextSelection: true,

            minRowsPerPage: Infinity,

            allowSelectAll: true,

            deselectOnRefresh: false
        });

    return declare([BorderContainer, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: i18n.renderTemplate(template),

        // Currently selected row
        selectedRow: null,

        // Show search string?
        likeSearch: true,

        // Диалоговое окно для выбора фильтров
        SearchWindow: null,

        // Объекты для выделения при инициализации объекта
        initialSelectRow: null,

        // Создание новой подписки
        createNew: false,

        constructor: function (params) {
            declare.safeMixin(this, params);
            this._gridInitialized = new Deferred();

            if (!this.createNew){
                this._gridConstruct();}
        },

        _gridConstruct: function () {
            var widget = this;
            api.route("feature_layer.field", {id: this.layerId})
                .get()
                .then(function (data) {
                    widget._fields = data;
                    widget._lookupTableData = {};

                    var lookupTableDefereds = [];
                    array.forEach(data, function (field) {
                        if (field.lookup_table != null) {
                            lookupTableDefereds.push(
                                lookupTableCached.load(field.lookup_table.id)
                            );
                        }
                    });

                    all(lookupTableDefereds).then(function () {
                        widget.initializeGrid();
                        return widget
                    }).then(function (widget){
                        if (widget.initialSelectRow) {
                            for (var key in widget.initialSelectRow.features) {
                                widget._grid.select(widget._grid.row(widget.initialSelectRow.features[key]))}
                        }
                    });
                });
        },

        /**
         * После создания: метод связывает функции коллбэки с тригеррами
         */
        postCreate: function () {
            // Создаем событие, открывает всплывающее окно поиска
            this.btnFilter.on("click", lang.hitch(this, this.createSearchWindow));
            this.chboxShowSelected.on("click", lang.hitch(this, this.useShowSelected));

            if (this.likeSearch) {
                // Search is needed, set search string processors
                this.tbSearch.on("input", lang.hitch(this, function () {
                    if (this._timer !== undefined) {
                        clearInterval(this._timer);
                    }
                    this._timer = setInterval(lang.hitch(this, this.updateSearch), 750);
                }));

                this.tbSearch.watch("value", lang.hitch(this, function (attr, oldVal, newVal) {
                    this.updateSearch();
                }));
            } else {
                // Search is not needed, hide it
                domStyle.set(this.tbSearch.domNode, "display", "none");
            }

            // Для создания новой подписки добавляем выбор email и resource
            if (this.createNew) {
                var widget = this

                // получаем email
                api.route("notification.email")
                    .get()
                    .then(function (respones) {

                        // создаем список email
                        var _emails = [], data = respones.data;
                        for (let key in data) {_emails.push({id: data[key].id, name: data[key].email})}
                        widget.emailStore = new Memory({data: _emails});

                        // получаем resource
                        api.route('resource.description')
                            .get()
                            .then(function (response){

                                // создаем список resource
                                if (response.data) {
                                    var _resources = []; data = response.data
                                    for (let elem in data) {_resources.push({id: data[elem].id, name: data[elem].resource})}
                                    widget.resourceStore = new Memory({data: _resources});

                                    // TODO ! ВАЖНЫЙ ВОПРОС !
                                    widget.btnEmailStore.store = widget.emailStore;
                                    widget.btnResourceStore.store = widget.resourceStore;

                                    widget.btnEmailStore.on("change", lang.hitch(widget, widget._chooseResource));
                                    widget.btnResourceStore.on("change", lang.hitch(widget, widget._chooseResource));
                                }
                            })
                    });
            }else{
                domStyle.set(this.btnEmailStore.domNode, "display", "none");
                domStyle.set(this.btnResourceStore.domNode, "display", "none");
            }
        },


        /**
         * Выбор email
         */
        _chooseEmail: function (){
            console.log('_chooseEmail')
            console.log(this.btnEmailStore.item)
        },

        /**
         * Выбор ресурса
         */
        _chooseResource: function (){
            this.createNew = false;
            if (this.btnResourceStore.item != undefined) {
                this.layerId = this.btnResourceStore.item.id;
            }

            // очищение от выделения
            if (this._grid){
                this._grid.clearSelection();
            }

            if(this.btnEmailStore.item){
                var widget = this;
                api.route("notification.subscriber.collection")
                    .get()
                    .then(function (response) {
                        // получаем строки для выделения
                        var findNnotif = null;
                        array.forEach(response.data, function (f) {
                            if (f.resource_id==widget.btnResourceStore.item.id
                                && f.email_id==widget.btnEmailStore.item.id){
                                findNnotif = f;
                            }
                        })
                        widget.initialSelectRow = findNnotif;

                        // создание таблицы
                        widget._gridConstruct();
                    });
            }else {
                this.initialSelectRow = undefined;
                this._gridConstruct();
            }
        },


        /**
         * Получаем данные о слое по API, создаем окно для фильтрации
         */
        createSearchWindow: function () {
            api.route("resource.item", {id: this.layerId})
                .get()
                .then((data) => {
                    if (!this.SearchWindow) {
                        this.SearchWindow = new SearchWindow({
                            widget: this,
                            layer_meta: data
                        });
                    }
                    this.SearchWindow.show();
                })
        },

        _getUserParamsForLayer: function () {
            let userParams = json.parse(localStorage.getItem('ngw_' + ngwConfig.userKeyName) || "{}");
            return userParams["ngw_layer_" + this.layerId.toString()] || {};
        },

        _setUserParamsForLayer: function (layerParams) {
            let userParams = json.parse(localStorage.getItem('ngw_' + ngwConfig.userKeyName) || "{}");
            userParams["ngw_layer_" + this.layerId.toString()] = layerParams;
            localStorage.setItem('ngw_' + ngwConfig.userKeyName, json.stringify(userParams));
        },

        /**
         * Создание таблицы
         */
        initializeGrid: function () {
            var lsLayerFields = this._getUserParamsForLayer();
            var storage_field = lsLayerFields ? lsLayerFields["id"] : undefined;
            var columns = [
                selector({label: "", selectorType: "checkbox", width: 21, unhidable: true}),
                {
                    field: "id",
                    label: "#",
                    unhidable: true,
                    sortable: true,
                    width: (!!storage_field && storage_field.width) ? storage_field.width : 20
                }];
            var fields = [];

            array.forEach(this._fields, function (f) {
                storage_field = lsLayerFields ? lsLayerFields[f.keyname] : undefined;
                var colDefn = {
                    field: "F:" + f.keyname,
                    label: f.display_name,
                    hidden: (!!storage_field && storage_field.hasOwnProperty("grid_visibility")) ? !storage_field.grid_visibility : !f.grid_visibility,
                    width: (!!storage_field && storage_field.hasOwnProperty("width")) ? storage_field.width : f.width_column
                };
                if (f.lookup_table != null) {
                    colDefn.get = function (object) {
                        var value = object['F:' + f.keyname];
                        if (f.lookup_table != null) {
                            var repr = lookupTableCached.lookup(f.lookup_table.id, value);
                            if (repr !== null) {
                                value = "[" + value + "] " + repr;
                            }
                        }
                        return value;
                    }
                }

                columns.push(colDefn);
                fields.push(f.keyname);
            });

            if (this.data === undefined) {
                this.store = new Observable(new FeatureStore({
                    layer: this.layerId,
                    fieldList: fields,
                    fieldPrefix: "F:"
                }));
            }

            // создание или обновление таблицы объектов
            if (this._grid) {
                this._grid.setStore(this.store);
            }else {
                this._grid = new GridClass({
                    store: this.store ? this.store : undefined,
                    columns: columns,
                    queryOptions: this.queryOptions
                });

                // Подпись для чекбокса "только выделенные"
                new LabelText({
                    for: this.chboxShowSelected.id,
                    value: i18n.gettext('Selected only'),
                    style: "margin-right: 5px"
                }).placeAt(this.infobar);

                // добавляем счетчик объектов на информационную панель
                this.objectCount = new LabelText({value: i18n.gettext("Objects") + ': ' + 0});
                this.infobar.addChild(this.objectCount);

                this.selectedCount = new LabelText({value: i18n.gettext("Selected: ") + 0});
                this.infobar.addChild(this.selectedCount);

                this._grid.on('dgrid-refresh-complete', this.resize.bind(this));

                if (this.data) {
                    this._grid.renderArray(this.data);
                }

                domStyle.set(this._grid.domNode, "height", "100%");
                domStyle.set(this._grid.domNode, "border", "none");

                // выделяем объект в таблице
                var widget = this;
                this._grid.on("dgrid-select", function (event) {
                    widget.selectFeatures({addRows: event.rows});
                });

                // убираем выделение объекта в таблице
                this._grid.on("dgrid-deselect", function (event) {
                    widget.selectFeatures({removeRows: event.rows});
                });

                this._grid.on('dgrid-refresh-complete', function (event) {
                    widget.objectCount.domNode.innerText = i18n.gettext("Objects") + ': ' + event.grid._total;
                });

                this._grid.on("dgrid-columnstatechange", function (event) {
                    let lsLayerFields = widget._getUserParamsForLayer();
                    var columnName = event.column.field;
                    if (columnName.startsWith('F:')) {
                        columnName = columnName.sufalsebstring(2);
                    }
                    var currenField = lsLayerFields[columnName] || {};
                    currenField.grid_visibility = !event.column.hidden;
                    lsLayerFields[columnName] = currenField;
                    widget._setUserParamsForLayer(lsLayerFields);
                });

                this._grid.on('dgrid-columnresize', function (event) {
                    var column = widget._grid.columns[event.columnId];
                    var columnName = column.field;
                    if (!!!columnName) {
                        return;
                    }
                    if (columnName.startsWith('F:')) {
                        columnName = columnName.substring(2);
                    }
                    lsLayerFields = widget._getUserParamsForLayer();
                    var currenField = lsLayerFields[columnName] || {};
                    currenField.width = event.width;
                    lsLayerFields[columnName] = currenField;
                    widget._setUserParamsForLayer(lsLayerFields);
                });

                if (!!this.plugin) {
                    this._grid.on(".dgrid-row:click", lang.hitch(this, this._onRowClick));
                }

                // подписка на событие, выделение строк в таблице
                this._listeners = [];
                this._listeners.push(topic.subscribe('grid.highlight', lang.hitch(this, this._onRowSelect)));
                this._listeners.push(topic.subscribe('grid.unhighlight', lang.hitch(this, this._onRowUnselect)));
                this._listeners.push(topic.subscribe('grid.clearstore', lang.hitch(this, this._onClearStore)));

                this._gridInitialized.resolve();
            }
        },

        /**
         * Очищает таблицу объектов, оставляет только выделенные объекты.
         */
        _onClearStore: function (event) {
            if (this.chboxShowSelected.checked) {
                this._grid.set("query", {fld_id: -1});
                this.set("selectedRow", null)
            }
        },

        /**
         * Обработчик события: выбор одного объекта на карте
         */
        _onRowSelect: function (event) {
            if (this.layerId !== event.layerId) {return;}

            // выбираем объекты в обычном режиме
            if (!this.chboxShowSelected.checked) {
                if (!event.multiSelect){this._grid.clearSelection()}

                var _selectedRow = this.get("selectedRow") || {};
                if (event.featureId in _selectedRow) {
                    this._grid.deselect(this._grid.row(event.featureId))
                } else {
                    this._grid.select(this._grid.row(event.featureId));
                }
            // показать только выделенные
            }else {
                if (!event.multiSelect) {
                    // выделен один объект в "показать выделенные"
                    this._grid.set("query", {fld_id__in: event.featureId});
                    var obj = {};
                    obj[event.featureId] = this._grid.row(event.featureId)
                    this.set("selectedRow", obj)
                    this._grid.select(this._grid.row(event.featureId))
                }else {
                    // выделено несколько объектов в "показать выделенные"
                    this._stateControl(true, event.featureId)
                }
            }
            this.updateObjectCount();
        },

        _onRowUnselect: function (event) {
            if (!!event && event.layerId && event.layerId !== this.layerId) {
                return;
            }
            this._grid.clearSelection();
        },

        _onRowClick: function (event) {
            this.plugin.display.identify._popup.setPosition(undefined);
        },

        /**
         * Обработчик события: выбор одного объекта в таблице объектов
         */
        selectFeatures: function (options) {
            var _selectedRows = this.get("selectedRow") || {};
            this.set("selectedRow", null);

            // запоминаем последний выделенный объект если он был
            options.addRows ? _selectedRows.last = options.addRows[options.addRows.length - 1] : delete _selectedRows.last;
            // получаем объекты для добавления
            array.forEach(options.addRows, function (itm) {
                _selectedRows[itm.id] = itm;
            });
            // получаем объекты для удаления
            array.forEach(options.removeRows, function (itm) {
                delete _selectedRows[itm.id];
            });
            this.set("selectedRow", Object.keys(_selectedRows).length === 0 ? null : _selectedRows);
            this.updateObjectCount()
        },

        /**
         * Обновляем счетчик текущих выделенных полей.
         */
        updateObjectCount: function (){
            // Нужно довести до ума LabelText чтобы значение текста устанавливалось через this.selectedCount.set("value", <значение>);
            let _selectedCount = !!this.selectedRow ? Object.keys(this.selectedRow).length : 0;
            if (this.selectedRow && this.selectedRow.last !== undefined){_selectedCount--}
            this.selectedCount.domNode.innerText = i18n.gettext("Selected: ") + _selectedCount;
        },

        // TODO счетчик выделенных объектов поправить
        startup: function () {
            this.inherited(arguments);

            var widget = this;
            this._gridInitialized.then(
                function () {
                    widget.gridPane.set("content", widget._grid.domNode);
                    widget._grid.startup();
                    if (widget.initialSelectRow) {
                        for (var key in widget.initialSelectRow) {
                            widget._grid.select(widget._grid.row(widget.initialSelectRow[key]))
                        }
                    }
                }
            );
           this.btnFilter.iconNode.setAttribute('data-icon', 'filter_alt');
        },

        destroy: function () {
            this._listeners.forEach(itm => itm.remove());
            this.inherited(arguments);
        },

        /**
         * Включение режима "Показа выделенные", при выключении возвращает все объекты.
         */
        useShowSelected: function () {
            if (!this.chboxShowSelected.checked) {
                // показать все объекты
                this._stateControl();
            } else {
                // показать только выделенные
                this._stateControl(true);
            }
        },

        /**
         * Обновляет таблицу объектов, возвращает выделенные ранее объекты.
         */
        _stateControl: function (queryOnly = false, currentFeatureId = null) {
            var num = [], query = {};
            var { last, ..._selectedRows } = this.get("selectedRow") || {};

            // если объект уже выбран, то изымаем его из выделенных
            var _feature = true;
            for (var key in _selectedRows){
                if (currentFeatureId === _selectedRows[key].id) {
                    delete _selectedRows[key]
                    _feature = false
                }
            }
            if (currentFeatureId && _feature) { num.push(currentFeatureId); }

            // показать только те объекты, что присутствуют среди выделенных
            if (queryOnly) {
                for (var key in _selectedRows) {
                    num.push(_selectedRows[key].id);
                }
                if (num.length === 0) {num.push(-1)}
                query.fld_id__in = num.join(',')
            }

            this._grid.set("query", query);

            // собираем выделенные объекты и выделяем их в таблице объектов
            if (queryOnly) {
                for (var key in num) {
                    if (num[key] !== -1) {
                        _selectedRows[num[key]] = this._grid.row(num[key]);
                        this._grid.select(this._grid.row(num[key]));
                    }
                }
            } else {
                for (var key in _selectedRows) {
                    this._grid.select(this._grid.row(_selectedRows[key]));
                }
            }

            // выделяем объекты в карте
            if (Object.keys(_selectedRows).length > 0){
                this.set("selectedRow", _selectedRows);
            }
            this.updateObjectCount()
        },

        /**
         * Обновление объектов таблицы, по поиску
         * */
        updateSearch: function () {
            if (this._timer !== undefined) {
                clearInterval(this._timer);
            }

            var value = this.tbSearch.get("value");
            var query = {like: this.tbSearch.get("value")};
            if (this._search != value) {
                this._search = value;

                // если режим только выделенные объекты
                if (this.chboxShowSelected.checked) {
                    var num = [], _selectedRows = {};
                    Object.assign(_selectedRows, this.get("selectedRow"));
                    for (var key in _selectedRows) {
                        num.push(_selectedRows[key].id);
                    }
                    query.fld_id__in = num.join(',')
                }

                this._grid.set("query", query);
            }
        },

        /**
         * Обновление объектов, после применения фильтрации
         */
        updateFeatureSearch: function (query) {
            // применение стилей для кнопки фильтрации
            if (Object.keys(query).length) {
                domClass.add(this.btnFilter.domNode, 'storeButtonFiltered');
            } else {
                domClass.remove(this.btnFilter.domNode, 'storeButtonFiltered');
            }

            // формируем запрос для фильтрации в зависимости от режима выделения
            if (this.chboxShowSelected.checked) {
                // формируем параметры запроса
                var num = [], _selectedRows = {}; Object.assign(_selectedRows, this.get("selectedRow"));
                for (var key in _selectedRows){num.push(_selectedRows[key].id);}
                query.fld_id__in = num.join(',')

                this._grid.set("query", query);

                // выделяем объекты
                for (var key in _selectedRows) {this._grid.select(this._grid.row(_selectedRows[key]));}
                this.set("selectedRow", _selectedRows)
            } else {
                this._grid.set("query", query);
            }
        },

        removeSelectFilter: function () {
            domClass.remove(this.btnFilter.domNode, 'storeButtonFiltered');
        }

    });
});
