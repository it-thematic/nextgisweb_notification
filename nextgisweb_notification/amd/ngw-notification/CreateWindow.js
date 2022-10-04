define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dijit/_Widget",
    "dojo/Deferred",
    "dojo/dom-construct",
    "dojo/promise/all",
    "dojo/store/Memory",
    "dojo/on",
    "dojo/_base/array",
    "dojo/touch",
    'dojo/request/xhr',
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
    "dijit/form/ComboBox",
    "ngw-feature-layer/LabelText",
    "@nextgisweb/pyramid/api",
    "@nextgisweb/pyramid/i18n!",
    "@nextgisweb/gui/error",
], function (
    declare,
    lang,
    _Widget,
    Deferred,
    domConstruct,
    all,
    Memory,
    on,
    array,
    touch,
    xhr,
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
    ComboBox,
    LabelText,
    api,
    i18n,
    error
) {

    return declare(Dialog, {
        title: i18n.gettext("Create notification"),

        constructor: function (options) {
            declare.safeMixin(this, options);
            this.parent_widget = options.widget

            // TODO переделать цепочку вызовов на async await
            var widget = this
            api.route("notification.email")
                .get()
                .then(function (data) {
                    widget.EmailStore = []
                    for (let key in data) {
                        widget.EmailStore.push({value: data[key].id, label: data[key].email})}

                    api.route('resource.description')
                        .get()
                        .then(function (data){
                            widget.ResourceStore = []
                            for (let elem in data) {
                                widget.ResourceStore.push({value:data[elem].id, label:data[elem].resource})}
                            widget.initializeWindow()
                        })
                });

        },

        // TODO доработка стилей для окна создания подписки
        initializeWindow: function () {
            this.inherited(arguments);

            this.mainContainer = new ContentPane({style: "max-height:500px"})
                .placeAt(this.containerNode);


            // выбор email
            this.tb_1 = new TableContainer({
                    cols: 3, showLabels: false, customClass: 'CustomTableContainer',
                }).placeAt(this.mainContainer);
            new LabelText({
                value: i18n.gettext("Email selection"),
                // style: 'display: block'
            }).placeAt(this.tb_1)
            this.EmailSelect = new Select({
                readonly: true,
                searchAttr: "name",
                style: "width: 150px;",
                options: this.EmailStore
            }).placeAt(this.tb_1);


            // выбор ресурсов
            this.tb_2 = new TableContainer({
                    cols: 3, showLabels: false, customClass: 'CustomTableContainer',
                }).placeAt(this.mainContainer);
            new LabelText({
                value: i18n.gettext("Resource selection"),
            }).placeAt(this.tb_2)
            this.ResourceSelect = new Select({
                readonly: true,
                searchAttr: "name",
                style: "width: 150px;",
                options: this.ResourceStore
            }).placeAt(this.tb_2);


            // контейнер для кнопок
            this.actionBarDown = domConstruct.create("div", {class: "dijitDialogPaneActionBar"}, this.containerNode);

            // добавляем кнопку применить фильтрацию
            this.btnOk = new Button({
                label: i18n.gettext("Apply"),
                onClick: lang.hitch(this, this.save),
                style: 'display: inline-block',
            }).placeAt(this.actionBarDown);

            // добавляем кнопку выхода
            this.btnCancle = new Button({
                label: i18n.gettext("Cancel"),
                onClick: lang.hitch(this, this.hide),
                style: 'display: inline-block'
            }).placeAt(this.actionBarDown);
        },

        /** Создает новую подписку на email и ресурс */
        save: function () {

            // получаем выбранный email и resource
            var email = this.EmailStore.filter(obj => {
              return obj.value === this.EmailSelect.value
            })
            var resource = this.ResourceStore.filter(obj => {
              return obj.value === this.ResourceSelect.value
            })

            // TODO доработать
            var queryParams = {
                resource_id: resource[0].value,
                resource: resource[0].label,
                email_id: email[0].value,
                email: email[0].label
            }

            this.widget.addNewRow(queryParams)
            this.hide()
        },
    });
});














        // initializeWindow: function () {
        //     this.inherited(arguments);
        //
        //     this.mainContainer = new ContentPane({style: "max-height:500px"})
        //         .placeAt(this.containerNode);
        //
        //     new LabelText({
        //         value: i18n.gettext("Choose email"),
        //         // style: 'display: block'
        //     }).placeAt(this.mainContainer)
        //
        //     // выбор email
        //     this.EmailSelect = new Select({
        //         readonly: true,
        //         searchAttr: "name",
        //         style: "width: 150px;",
        //         options: this.EmailStore
        //     }).placeAt(this.mainContainer);
        //
        //     new LabelText({
        //         value: i18n.gettext("Choose resource"),
        //     }).placeAt(this.mainContainer)
        //
        //     // выбор ресурсов
        //     this.ResourceSelect = new Select({
        //         readonly: true,
        //         searchAttr: "name",
        //         style: "width: 150px;",
        //         options: this.ResourceStore
        //     }).placeAt(this.mainContainer);
        //
        //     // контейнер для кнопок
        //     this.actionBarDown = domConstruct.create("div", {class: "dijitDialogPaneActionBar"}, this.containerNode);
        //
        //     // добавляем кнопку применить фильтрацию
        //     this.btnOk = new Button({
        //         label: i18n.gettext("Apply"),
        //         onClick: lang.hitch(this, this.save),
        //         style: 'display: inline-block',
        //     }).placeAt(this.actionBarDown);
        //
        //     // добавляем кнопку выхода
        //     this.btnCancle = new Button({
        //         label: i18n.gettext("Cancel"),
        //         onClick: lang.hitch(this, this.hide),
        //         style: 'display: inline-block'
        //     }).placeAt(this.actionBarDown);
        // },




