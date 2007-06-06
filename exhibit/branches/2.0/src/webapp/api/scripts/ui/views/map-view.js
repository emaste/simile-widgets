/*==================================================
 *  Exhibit.MapView
 *==================================================
 */

Exhibit.MapView = function(containerElmt, uiContext) {
    this._div = containerElmt;
    this._uiContext = uiContext;

    this._settings = {};
    this._accessors = {
        getProxy: function(itemID, database, visitor) { visitor(itemID); },
        getColorKey: null
    };
    this._colorCoder = null;
    
    var view = this;
    this._listener = { 
        onItemsChanged: function() {
            view._reconstruct(); 
        }
    };
    uiContext.getCollection().addListener(this._listener);
};

Exhibit.MapView._settingSpecs = {
    "center":           { type: "float",    defaultValue: [20,0],   dimensions: 2 },
    "zoom":             { type: "float",    defaultValue: 2         },
    "size":             { type: "text",     defaultValue: "small"   },
    "scaleControl":     { type: "boolean",  defaultValue: true      },
    "overviewControl":  { type: "boolean",  defaultValue: false     },
    "type":             { type: "enum",     defaultValue: "normal", choices: [ "normal", "satellite", "hybrid" ] },
    "bubbleTip":        { type: "enum",     defaultValue: "top",    choices: [ "top", "bottom" ] },
    "mapHeight":        { type: "int",      defaultValue: 400       },
    "mapConstructor":   { type: "function", defaultValue: null      },
    "color":            { type: "text",     defaultValue: "#FF9000" },
    "colorCoder":       { type: "text",     defaultValue: null      }
};

Exhibit.MapView._accessorSpecs = [
    {   accessorName:   "getProxy",
        attributeName:  "proxy"
    },
    {   accessorName: "getLatlng",
        alternatives: [
            {   bindings: [
                    {   attributeName:  "latlng",
                        types:          [ "float", "float" ],
                        bindingNames:   [ "lat", "lng" ]
                    },
                    {   attributeName:  "maxAutoZoom",
                        type:           "float",
                        bindingName:    "maxAutoZoom",
                        optional:       true
                    }
                ]
            },
            {   bindings: [
                    {   attributeName:  "lat",
                        type:           "float",
                        bindingName:    "lat"
                    },
                    {   attributeName:  "lng",
                        type:           "float",
                        bindingName:    "lng"
                    },
                    {   attributeName:  "maxAutoZoom",
                        type:           "float",
                        bindingName:    "maxAutoZoom",
                        optional:       true
                    }
                ]
            }
        ]
    },
    {   accessorName:   "getColorKey",
        attributeName:  "marker", // backward compatibility
        type:           "text"
    },
    {   accessorName:   "getColorKey",
        attributeName:  "colorKey",
        type:           "text"
    }
];

Exhibit.MapView.create = function(configuration, containerElmt, uiContext) {
    var view = new Exhibit.MapView(
        containerElmt,
        Exhibit.UIContext.create(configuration, uiContext)
    );
    Exhibit.MapView._configure(view, configuration);
    
    view._internalValidate();
    view._initializeUI();
    return view;
};

Exhibit.MapView.createFromDOM = function(configElmt, containerElmt, uiContext) {
    var configuration = Exhibit.getConfigurationFromDOM(configElmt);
    var view = new Exhibit.MapView(
        containerElmt != null ? containerElmt : configElmt, 
        Exhibit.UIContext.createFromDOM(configElmt, uiContext)
    );
    
    Exhibit.SettingsUtilities.createAccessorsFromDOM(configElmt, Exhibit.MapView._accessorSpecs, view._accessors);
    Exhibit.SettingsUtilities.collectSettingsFromDOM(configElmt, Exhibit.MapView._settingSpecs, view._settings);
    Exhibit.MapView._configure(view, configuration);
    
    view._internalValidate();
    view._initializeUI();
    return view;
};

Exhibit.MapView._configure = function(view, configuration) {
    Exhibit.SettingsUtilities.createAccessors(configuration, Exhibit.MapView._accessorSpecs, view._accessors);
    Exhibit.SettingsUtilities.collectSettings(configuration, Exhibit.MapView._settingSpecs, view._settings);
    
    var accessors = view._accessors;
    view._getLatlng = function(itemID, database, visitor) {
        accessors.getProxy(itemID, database, function(proxy) {
            accessors.getLatlng(proxy, database, visitor);
        });
    };
};

Exhibit.MapView.lookupLatLng = function(set, addressExpressionString, outputProperty, outputTextArea, database, accuracy) {
    if (accuracy == undefined) {
        accuracy = 4;
    }
    
    var expression = Exhibit.ExpressionParser.parse(addressExpressionString);
    var jobs = [];
    set.visit(function(item) {
        var address = expression.evaluateSingle(
            { "value" : item },
            { "value" : "item" },
            "value",
            database
        ).value
        if (address != null) {
            jobs.push({ item: item, address: address });
        }
    });
    
    var results = [];
    var geocoder = new GClientGeocoder();
    var cont = function() {
        if (jobs.length > 0) {
            var job = jobs.shift();
            geocoder.getLocations(
                job.address,
                function(json) {
                    if ("Placemark" in json) {
                        json.Placemark.sort(function(p1, p2) {
                            return p2.AddressDetails.Accuracy - p1.AddressDetails.Accuracy;
                        });
                    }
                    
                    if ("Placemark" in json && 
                        json.Placemark.length > 0 && 
                        json.Placemark[0].AddressDetails.Accuracy >= accuracy) {
                        
                        var coords = json.Placemark[0].Point.coordinates;
                        var lat = coords[1];
                        var lng = coords[0];
                        results.push("\t{ id: '" + job.item + "', " + outputProperty + ": '" + lat + "," + lng + "' }");
                    } else {
                        var segments = job.address.split(",");
                        if (segments.length == 1) {
                            results.push("\t{ id: '" + job.item + "' }");
                        } else {
                            job.address = segments.slice(1).join(",").replace(/^\s+/, "");
                            jobs.unshift(job); // do it again
                        }
                    }
                    cont();
                }
            );
        } else {
            outputTextArea.value = results.join(",\n");
        }
    };
    cont();
};

Exhibit.MapView.prototype.dispose = function() {
    this._uiContext.getCollection().removeListener(this._listener);
    
    this._map = null;
    
    this._toolboxWidget.dispose();
    this._toolboxWidget = null;
    
    this._dom.dispose();
    this._dom = null;
    
    this._uiContext.dispose();
    this._uiContext = null;
    
    this._div.innerHTML = "";
    this._div = null;
    
    GUnload();
};

Exhibit.MapView.prototype._internalValidate = function() {
    if ("getColorKey" in this._accessors) {
        if ("colorCoder" in this._settings) {
            this._colorCoder = this._uiContext.getExhibit().getComponent(this._settings.colorCoder);
        }
        
        if (this._colorCoder == null) {
            this._colorCoder = new Exhibit.DefaultColorCoder(this._uiContext);
        }
    }
};

Exhibit.MapView.prototype._initializeUI = function() {
    var self = this;
    var settings = this._settings;
    
    this._div.innerHTML = "";
    this._dom = Exhibit.ViewUtilities.constructPlottingViewDom(
        this._div, 
        this._uiContext, 
        true, // showSummary
        {   onResize: function() { 
                self._map.checkResize(); 
            } 
        }, 
        {   markerGenerator: function(color) {
                var shape = "square";
                return SimileAjax.Graphics.createTranslucentImage(
                    Exhibit.MapView._markerUrlPrefix +
                        "?renderer=map-marker&shape=" + Exhibit.MapView._defaultMarkerShape + 
                        "&width=20&height=20&pinHeight=5&background=" + color.substr(1),
                    "middle"
                );
            }
        }
    );    
    this._toolboxWidget = Exhibit.ToolboxWidget.createFromDOM(this._div, this._div, this._uiContext);
    
    var mapDiv = this._dom.plotContainer;
    mapDiv.style.height = settings.mapHeight + "px";
    mapDiv.className = "exhibit-mapView-map";
    
    var settings = this._settings;
    if (settings._mapConstructor != null) {
        this._map = settings._mapConstructor(mapDiv);
    } else {
        this._map = new GMap2(mapDiv);
        this._map.enableDoubleClickZoom();
        this._map.enableContinuousZoom();

        this._map.setCenter(new GLatLng(settings.center[0], settings.center[1]), settings.zoom);
        
        this._map.addControl(settings.size == "small" ? new GSmallMapControl() : new GLargeMapControl());
        if (settings.overviewControl) {
            this._map.addControl(new GOverviewMapControl);
        }
        if (settings.scaleControl) {
            this._map.addControl(new GScaleControl());
        }
        
        this._map.addControl(new GMapTypeControl());
        switch (settings.type) {
        case "normal":
            this._map.setMapType(G_NORMAL_MAP);
            break;
        case "satellite":
            this._map.setMapType(G_SATELLITE_MAP);
            break;
        case "hybrid":
            this._map.setMapType(G_HYBRID_MAP);
            break;
        }
    }
    this._reconstruct();
};

Exhibit.MapView.prototype._reconstruct = function() {
    var self = this;
    var collection = this._uiContext.getCollection();
    var database = this._uiContext.getDatabase();
    var settings = this._settings;
    var accessors = this._accessors;
    
    /*
     *  Get the current collection and check if it's empty
     */
    var originalSize = collection.countAllItems();
    var currentSize = collection.countRestrictedItems();
    var unplottableItems = [];
    
    this._map.clearOverlays();
    this._dom.legendWidget.clear();
    if (currentSize > 0) {
        var currentSet = collection.getRestrictedItems();
        var locationToData = {};
        var hasColorKey = (this._accessors.getColorKey != null);
        
        currentSet.visit(function(itemID) {
            var latlngs = [];
            self._getLatlng(itemID, database, function(v) { if ("lat" in v && "lng" in v) latlngs.push(v); });
            
            if (latlngs.length > 0) {
                var colorKeys = null;
                if (hasColorKey) {
                    colorKeys = new Exhibit.Set();
                    accessors.getColorKey(itemID, database, function(v) { colorKeys.add(v); });
                }
                
                for (var n = 0; n < latlngs.length; n++) {
                    var latlng = latlngs[n];
                    var latlngKey = latlng.lat + "," + latlng.lng;
                    if (latlngKey in locationToData) {
                        var locationData = locationToData[latlngKey];
                        locationData.items.push(itemID);
                        if (hasColorKey) {
                            locationData.colorKeys.addSet(colorKeys);
                        }
                    } else {
                        var locationData = {
                            latlng:     latlng,
                            items:      [ itemID ]
                        };
                        if (hasColorKey) {
                            locationData.colorKeys = colorKeys;
                        }
                        locationToData[latlngKey] = locationData;
                    }
                }
            } else {
                unplottableItems.push(itemID);
            }
        });
        
        var colorCodingFlags = { mixed: false, missing: false, others: false, keys: new Exhibit.Set() };
        var shape = Exhibit.MapView._defaultMarkerShape;
        var bounds, maxAutoZoom = Infinity;
        var addMarkerAtLocation = function(locationData) {
            var itemCount = locationData.items.length;
            if (!bounds) {
                bounds = new GLatLngBounds();
            }
            
            var color = self._settings.color;
            if (hasColorKey) {
                color = self._colorCoder.translateSet(locationData.colorKeys, colorCodingFlags);
            }
            
            var icon = Exhibit.MapView._makeIcon(
                shape, 
                color, 
                itemCount == 1 ? "" : itemCount.toString(),
                self._settings.bubbleTip
            );
            
            var point = new GLatLng(locationData.latlng.lat, locationData.latlng.lng);
            var marker = new GMarker(point, icon);
            if (maxAutoZoom > locationData.latlng.maxAutoZoom) {
                maxAutoZoom = locationData.latlng.maxAutoZoom;
            }
            bounds.extend(point);
            
            GEvent.addListener(marker, "click", function() { 
                marker.openInfoWindow(self._createInfoWindow(locationData.items));
            });
            self._map.addOverlay(marker);
        }
        for (var latlngKey in locationToData) {
            addMarkerAtLocation(locationToData[latlngKey]);
        }
        
        if (hasColorKey) {
            var legendWidget = this._dom.legendWidget;
            var colorCoder = this._colorCoder;
            var keys = colorCodingFlags.keys.toArray().sort();
            for (var k = 0; k < keys.length; k++) {
                var key = keys[k];
                var color = colorCoder.translate(key);
                legendWidget.addEntry(color, key);
            }
            
            if (colorCodingFlags.others) {
                legendWidget.addEntry(colorCoder.getOthersColor(), colorCoder.getOthersLabel());
            }
            if (colorCodingFlags.mixed) {
                legendWidget.addEntry(colorCoder.getMixedColor(), colorCoder.getMixedLabel());
            }
            if (colorCodingFlags.missing) {
                legendWidget.addEntry(colorCoder.getMissingColor(), colorCoder.getMissingLabel());
            }
        }
        
        if (bounds && typeof settings.zoom == "undefined") {
            var zoom = Math.max(0, self._map.getBoundsZoomLevel(bounds) - 1);
            zoom = Math.min(zoom, maxAutoZoom, settings.maxAutoZoom);
            self._map.setZoom(zoom);
        }
        if (bounds && typeof settings.center == "undefined") {
            self._map.setCenter(bounds.getCenter());
        }
    }
    this._dom.setUnplottableMessage(currentSize, unplottableItems);
};

Exhibit.MapView.prototype._createInfoWindow = function(items) {
    return Exhibit.ViewUtilities.fillBubbleWithItems(
        null, 
        items, 
        this._uiContext
    );
};

Exhibit.MapView._iconData = null;
Exhibit.MapView._markerUrlPrefix = "http://simile.mit.edu/painter/painter?";
Exhibit.MapView._defaultMarkerShape = "circle";

Exhibit.MapView._makeIcon = function(shape, color, label, bubbleTip) {
    var extra = label.length * 3;
    var halfWidth = 12 + extra;
    var width = halfWidth * 2;
    var bodyHeight = 24;
    var pinHeight = 6;
    var pinHalfWidth = 3;
    var height = bodyHeight + pinHeight;
    
    var icon = new GIcon();
    icon.image = Exhibit.MapView._markerUrlPrefix + [
        "renderer=map-marker",
        "shape=" + shape,
        "width=" + width,
        "height=" + bodyHeight,
        "pinHeight=" + pinHeight,
        "pinWidth=" + (pinHalfWidth * 2),
        "background=" + color.substr(1),
        "label=" + label
    ].join("&");
    icon.shadow = Exhibit.MapView._markerUrlPrefix + [
        "renderer=map-marker-shadow",
        "shape=" + shape,
        "width=" + width,
        "height=" + bodyHeight,
        "pinHeight=" + pinHeight,
        "pinWidth=" + (pinHalfWidth * 2)
    ].join("&");
    icon.iconSize = new GSize(width, height);
    icon.iconAnchor = new GPoint(halfWidth, height);
    icon.imageMap = [ 
        0, 0, 
        0, bodyHeight, 
        halfWidth - pinHalfWidth, bodyHeight,
        halfWidth, height,
        halfWidth + pinHalfWidth, bodyHeight,
        width, bodyHeight,
        width, 0
    ];
    icon.shadowSize = new GSize(width * 1.5, height - 2);
    icon.infoWindowAnchor = (bubbleTip == "bottom") ? new GPoint(halfWidth, height) : new GPoint(halfWidth, 0);
    
    return icon;
};
