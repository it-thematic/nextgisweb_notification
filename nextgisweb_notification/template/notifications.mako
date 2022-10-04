<%inherit file='nextgisweb:pyramid/template/base.mako' />

<script type="text/javascript">
    require([
        "dojo/dom",
        "ngw-notification/WidgetNotification",
        "dijit/form/Button",
        "dijit/form/TextBox",
        "dojo/domReady!"
    ], function (dom, WidgetNotification, Button, TextBox) {
        var grid = new WidgetNotification({
            style: "width: 100%; height: 100%; padding: 0"
        });
        grid.placeAt(dom.byId("grid"));
        grid.startup();
    });
</script>

<div id="grid" style="width: 100%; height: 100%; padding: 0;"></div>
