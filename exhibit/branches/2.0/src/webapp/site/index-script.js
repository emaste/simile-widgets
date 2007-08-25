function onLoad() {
    var examples = [
        {   url:        "examples/presidents/presidents-2.html",
            screenshot: "images/example-screenshot-presidents.png"
        },
        {   url:        "examples/flags/flags.html",
            screenshot: "images/example-screenshot-flags.png"
        },
        {   url:        "examples/cereals/cereals.html",
            screenshot: "images/example-screenshot-cereals.png"
        },
        {   url:        "examples/billionaires/billionaires.html",
            screenshot: "images/example-screenshot-billionnaires.png"
        },
        {   url:        "examples/senate/senate.html",
            screenshot: "images/example-screenshot-senate.png"
        },
        {   url:        "examples/nobelists/nobelists.html",
            screenshot: "images/example-screenshot-nobelists.png"
        },
        {   url:        "examples/factbook/factbook-people.html",
            screenshot: "images/example-screenshot-factbook.png"
        },
        {   url:        "examples/CSAIL-PIs/CSAIL-PIs.html",
            screenshot: "images/example-screenshot-csail-pis.png"
        },
        {   url:        "examples/cities/cities.html",
            screenshot: "images/example-screenshot-cities.png"
        }
    ];
    
    var carouselContent = document.getElementById("carousel-content");
    var tr = carouselContent.rows[0];
    
    var makeExample = function(index) {
        var example = examples[index];
        
        var img = document.createElement("img");
        img.src = example.screenshot;
        img.className = "example-screenshot";
        img.onclick = function() { showExample(examples[index].url); };
        
        var td = tr.insertCell(index);
        td.appendChild(img);
    }
    
    for (var i = 0; i < examples.length; i++) {
        makeExample(i);
    }
    showHideScrollButtons();
    
    window.onresize = onWindowResize;
}

function onWindowResize() {
    var carousel = document.getElementById("carousel");
    var carouselContent = document.getElementById("carousel-content");
    
    carouselContent.style.left = 
        Math.max(
            Math.min(carouselContent.offsetLeft, 0), 
            carousel.offsetWidth - carouselContent.offsetWidth
        ) + "px";
        
    showHideScrollButtons();
}

function showExample(url) {
    window.open(url);
}

function showHideScrollButtons() {
    var carousel = document.getElementById("carousel");
    var carouselContent = document.getElementById("carousel-content");
    
    var scrollLeftButton = document.getElementById("scroll-left");
    var scrollRightButton = document.getElementById("scroll-right");
    scrollLeftButton.style.display = (carouselContent.offsetLeft < -1) ? "block" : "none";
    scrollRightButton.style.display = (carouselContent.offsetLeft + carouselContent.offsetWidth > carousel.offsetWidth) ? "block" : "none";
}

var animating = false;
function scrollToLeft() {
    if (animating) return;
    
    var carousel = document.getElementById("carousel");
    var carouselContent = document.getElementById("carousel-content");
    
    var from = carouselContent.offsetLeft;
    var to = Math.min(
        carouselContent.offsetLeft + Math.floor(0.8 * carousel.offsetWidth),
        0
    );
    
    animating = true;
    new Animation(
        function(current, change) {
            carouselContent.style.left = current + "px";
        }, 
        from, 
        to, 
        1000,
        function() {
            animating = false;
            showHideScrollButtons();
        }
    ).run();
}

function scrollToRight() {
    if (animating) return;
    
    var carousel = document.getElementById("carousel");
    var carouselContent = document.getElementById("carousel-content");
    
    var from = carouselContent.offsetLeft;
    var to = Math.max(
        carouselContent.offsetLeft - Math.floor(0.8 * carousel.offsetWidth),
        carousel.offsetWidth - carouselContent.offsetWidth
    );
    
    animating = true;
    new Animation(
        function(current, change) {
            carouselContent.style.left = current + "px";
        }, 
        from, 
        to, 
        1000,
        function() {
            animating = false;
            showHideScrollButtons();
        }
    ).run();
}

function Animation(f, from, to, duration, cont) {
    this.f = f;
    this.cont = (typeof cont == "function") ? cont : function() {};
    
    this.from = from;
    this.to = to;
    this.current = from;
    
    this.duration = duration;
    this.start = new Date().getTime();
    this.timePassed = 0;
};

Animation.prototype.run = function() {
    var a = this;
    window.setTimeout(function() { a.step(); }, 50);
};

Animation.prototype.step = function() {
    this.timePassed += 50;
    
    var timePassedFraction = this.timePassed / this.duration;
    var parameterFraction = -Math.cos(timePassedFraction * Math.PI) / 2 + 0.5;
    var current = parameterFraction * (this.to - this.from) + this.from;
    
    try {
        this.f(current, current - this.current);
    } catch (e) {
    }
    this.current = current;
    
    if (this.timePassed < this.duration) {
        this.run();
    } else {
        this.f(this.to, 0);
        this["cont"]();
    }
};
