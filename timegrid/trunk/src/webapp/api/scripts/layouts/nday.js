/******************************************************************************
 * NDayLayout
 * @fileoverview
 *   This is where the n-day layout is defined.  The layout is designed to 
 *   resemble the equivalent Google Calendar view.
 * @author masont
 *****************************************************************************/
 
 /**
  * Constructs an NDayLayout object.
  * @class NDayLayout is a subclass of Layout that implements an n-day event
  *   calendar, modeled off of the weekly view found in Google Calendar.
  * @extends Timegrid.Layout
  * @constructor
  */
Timegrid.NDayLayout = function(eventSource, params) {
    Timegrid.NDayLayout.superclass.call(this, eventSource, params);
    var self = this;
    
    // Specifications for a week layout
    this.xSize = 7;
    this.ySize = 24;
    this.iterable = true;

    this.xMapper = function(obj) { 
        var time = self.timezoneMapper(obj.time);
        var start = self.timezoneMapper(self.startTime);
        var ivl = new SimileAjax.DateTime.Interval(time - start); 
        return ivl.days; 
    };
    this.yMapper = function(obj) { 
        var time = self.timezoneMapper(obj.time);
        return time.getHours() + time.getMinutes() / 60.0;
    };
    
    // These are default values that can be overridden in configure
    this.n = 3;
    
    this.configure(params);
    this.title = params.title || Timegrid.NDayLayout.l10n.makeTitle(this.n);
    this.xSize = this.n;
    this.computeCellSizes();
    
    // Initialize our eventSource
    this.eventSource = eventSource;
    this.startTime = new Date(this.eventSource.getEarliestDate()) || new Date();
    this.startTime.setHours(0);
    this.endTime = this.computeEndTime(this.startTime); 
    this.initializeGrid();
};
Timegrid.LayoutFactory.registerLayout("n-day", Timegrid.NDayLayout);

Timegrid.NDayLayout.prototype.initializeGrid = function() {
    var now = new Date();
    if (now.isBetween(this.startTime, this.endTime)) { this.now = now; }
    
    this.endpoints = [];
    if (this.startTime) {
        var iterator = this.eventSource.getEventIterator(this.startTime,
                                                         this.endTime);
        while (iterator.hasNext()) {
            var ends = Timegrid.NDayLayout.getEndpoints(iterator.next());
            this.endpoints.push(ends[0]);
            this.endpoints.push(ends[1]);
        }
    }
    this.endpoints.sort(function(a, b) { 
        var diff = a.time - b.time;
        if (!diff) {
            return a.type == "start" ? 1 : -1;
        } else {
            return diff;
        }
    });
};

Timegrid.NDayLayout.prototype.renderEvents = function(doc) {
    var eventContainer = doc.createElement("div");
    $(eventContainer).addClass("timegrid-events");
    var currentEvents = {};
    var currentCount = 0;
    for (i in this.endpoints) {
        var endpoint = this.endpoints[i];
        var x = this.xMapper(endpoint);
        var y = this.yMapper(endpoint);
        if (endpoint.type == "start") {
            // Render the event
            var eventDiv = this.renderEvent(endpoint.event, x, y);
            eventContainer.appendChild(eventDiv);
            // Push the event div onto the current events set
            currentEvents[endpoint.event.getID()] = eventDiv;
            currentCount++;
            // Adjust widths and offsets as necessary
            var hIndex = 0;
            for (id in currentEvents) {
                var eDiv = currentEvents[id];
                var newWidth = this.xCell / currentCount;
                var newLeft = this.xCell * x + newWidth * hIndex;
                $(eDiv).css("width", newWidth + "%");
                $(eDiv).css("left", newLeft + "%");
                hIndex++;
            }
        } else if (endpoint.type == "end") {
            // Pop event from current events set
            delete currentEvents[endpoint.event.getID()];
            currentCount--;
        }
    }
    return eventContainer;
};

Timegrid.NDayLayout.prototype.renderEvent = function(evt, x, y) {
    var jediv = $("<div><div>" + evt.getText() + "</div></div>");
    var length = (evt.getEnd() - evt.getStart()) / (1000 * 60 * 60.0);
    jediv.addClass("timegrid-event").addClass('timegrid-rounded-shadow');
    jediv.css("height", this.yCell * length);
    jediv.css("top", this.yCell * y);
    jediv.css("left", this.xCell * x + '%');
    if (evt.getColor()) { jediv.css('background-color', evt.getColor()); }
    if (evt.getTextColor()) { jediv.css('color', evt.getTextColor()); }
    return jediv.get()[0]; // Return the actual DOM element
};

Timegrid.NDayLayout.prototype.getXLabels = function() {
    var date = new Date(this.startTime);
    var labels = [];
    while (date < this.endTime) {
        labels.push(date.format(Timegrid.NDayLayout.l10n.xLabelFormat));
        date.setHours(24);
    }
    return labels;
};

Timegrid.NDayLayout.prototype.getYLabels = function() {
    // FIXME: Change this to proper localized label rendering
    return [ "12am", "1am", "2am", "3am", "4am", "5am", "6am", "7am", "8am",
             "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm",
             "6pm", "7pm", "8pm", "9pm", "10pm", "11pm" ];
};

Timegrid.NDayLayout.prototype.goPrevious = function() {
    this.endTime = this.startTime;
    this.startTime = this.computeStartTime(this.endTime);
    this.initializeGrid();
    this.render();
};

Timegrid.NDayLayout.prototype.goNext = function() {
    this.startTime = this.endTime;
    this.endTime = this.computeEndTime(this.startTime);
    this.initializeGrid();
    this.render();
};

Timegrid.NDayLayout.prototype.getCurrent = function() {
    this.endTime.add('s', -1);
    var result = Timegrid.NDayLayout.l10n.makeRange(this.startTime,
                                                    this.endTime);
    this.endTime.add('s', 1);
    return result;
};

Timegrid.NDayLayout.prototype.computeStartTime = function(date) {
    if (date) {
        var startTime = new Date(date);
        startTime.add('d', 0 - this.n);
        startTime.setHours(0);
        return startTime;
    }
    return false;
};

Timegrid.NDayLayout.prototype.computeEndTime = function(date) {
    if (date) {
        var endTime = new Date(date);
        endTime.add('d', this.n);
        endTime.setHours(0);
        return endTime;
    }
    return false;
};

Timegrid.NDayLayout.getEndpoints = function(evt) {
    return [ { type: "start",
               time: evt.getStart(),
               event: evt },
             { type: "end",
               time: evt.getEnd(),
               event: evt } ];
};

