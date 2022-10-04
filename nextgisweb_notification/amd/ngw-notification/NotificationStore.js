define([
    "dojo/_base/declare",
    "dojo/store/JsonRest",
    "dojo/json",
    "ngw/route",
], function (
    declare,
    JsonRest,
    json,
    route
) {
    return declare(JsonRest, {
        constructor: function (options) {
            this.target = route.notification.subscriber.collection();

            if (this.fieldList) { this.headers["X-Field-List"] =
                encodeURIComponent(json.stringify(this.fieldList)); }
            if (this.fieldPrefix) { this.headers["X-Field-Prefix"] =
                encodeURIComponent(json.stringify(this.fieldPrefix)); }

            if (this.featureBox) { this.headers["X-Feature-Box"] = true; }
            if (this.featureExt) { this.headers["X-Feature-Ext"] = this.featureExt; }
        }
    });
});
