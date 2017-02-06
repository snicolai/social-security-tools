/**
 * Code for driving a breakpoint chart. See partials/breakpoint-chart.html
 * @constructor
 */
function BreakPointChart() {
  this.canvas_ = null;
  this.lastRenderedXDollars = -1;
}

/**
 * Returns true if the BreakPointChart has been initialized with a canvas
 * element and taxEngine.
 * @return {boolean}
 */
BreakPointChart.prototype.isInitialized = function() {
  return this.canvas_ !== null && this.taxEngine !== null;
};

/**
 * Sets the canvas on which to render the chart.
 * @param {Element} canvas_element
 */
BreakPointChart.prototype.setCanvas = function(canvas_element) {
  this.canvas_ = canvas_element;
  this.context_ = this.canvas_.getContext('2d');
  // Set the font we will use for labels early so we can measure it's width.
  this.context_.font = "bold 14px Helvetica"
  this.mouseToggle = 'ON';

  this.canvas_.addEventListener('mousedown', this.mouseClickListener());
  this.canvas_.addEventListener('mousemove', this.mouseMoveListener());
};

/**
 * Set the taxEngine from which to pull financial data.
 * @param {TaxEngine} taxEngine
 */
BreakPointChart.prototype.setTaxEngine = function(taxEngine) {
  this.taxEngine_ = taxEngine;
};

/**
 * Compute the usable width of the canvas allowable for the chart.
 * @return {number}
 */
BreakPointChart.prototype.chartWidth = function() {
  // A 6-digit social security payment would be about the highest we
  // would imagine someone receiving, so we reserve space on the right
  // to display such a value with a little added padding.
  var reservedWidth = Math.ceil(
      this.context_.measureText('$999,999').width) + 10;
  var usableWidth = this.canvas_.width - reservedWidth;
  return usableWidth;
};

/**
 * Compute the usable height of the canvas allowable for the chart.
 * @return {number}
 */
BreakPointChart.prototype.chartHeight = function() {
  // A 12pt font is 16 pixels high. We reserve a little extra for padding.
  var reservedHeight = 16 + 10;
  var usableHeight = this.canvas_.height - reservedHeight;
  return usableHeight;
};

/**
 * Compute the canvas x-coordinate for a earnings dollars value.
 * @param {number} earningsX
 * @return {number}
 */
BreakPointChart.prototype.canvasX = function(earningsX) {
  var xValue = Math.floor(
      earningsX / this.maxRenderedXDollars() * this.chartWidth());
  var xClipped = Math.min(xValue, this.chartWidth());
  return xClipped;
};

/**
 * Compute the canvas y-coordinate for a benefit dollars value.
 * @param {number} benefitY
 * @return {number}
 */
BreakPointChart.prototype.canvasY = function(benefitY) {
  var yValue = this.chartHeight() -
      Math.floor(benefitY / this.maxRenderedYDollars() * this.chartHeight());
  var yClipped = Math.min(yValue, this.chartHeight());
  return yClipped;
};

/**
 * Compute the canvas earnings dollars for an x-coordinate value.
 * Used for computations involving mouse interactions.
 * @param {number} canvasX
 * @return {number}
 */
BreakPointChart.prototype.earningsX = function(canvasX) {
  var xValue = Math.floor(
      Math.max(0, canvasX / this.chartWidth()) * this.maxRenderedXDollars());
  var xClipped = this.maxRenderedXDollars();
  return Math.min(xValue, xClipped);
};

/**
 * Selects a x-coordinate (in dollars) to be the rightmost edge
 * of our chart.
 * @return {Number}
 */
BreakPointChart.prototype.maxRenderedXDollars = function() {
  // There are a few goals here when selecting this value:
  // 1) Show all of the breakpoints so the user can get a feel visually
  //    for how these breakpoints affect the computation.
  var breakpoint_min = this.taxEngine_.secondBendPoint() * 1.25;
  // 2) Show the user's current earnings with some space on either side
  //    so that they can explore the graph to either direction.
  var user_min = this.taxEngine_.monthlyIndexedEarnings * 2;

  var computed = Math.max(breakpoint_min, user_min);

  // We would prefer to keep the viewport fixed as the user changes
  // the benefit, so that it's easier to see what is going on. However
  // we will adjust if the value gets too close to the edges.
  if (this.lastRenderedXDollars === -1 ||
      this.lastRenderedXDollars > computed * 1.3 ||
      this.lastRenderedXDollars < computed / 1.3)
   this.lastRenderedXDollars = computed;

  return this.lastRenderedXDollars;
};

/**
 * Selects a y-coordinate (in dollars) to be the topmost edge
 * of our chart.
 * @return {Number}
 */
BreakPointChart.prototype.maxRenderedYDollars = function() {
  return this.taxEngine_.primaryInsuranceAmountForEarnings(
      this.maxRenderedXDollars());
};

/**
 * Utility method which walls lineTo on this.canvas_ after transforming
 * dollarX and dollarY into canvas x/y coordinates.
 * @param {Number} dollarX
 * @param {Number} dollarY
 */
BreakPointChart.prototype.lineTo = function(dollarX, dollarY) {
  this.context_.lineTo(this.canvasX(dollarX), this.canvasY(dollarY));
};

/**
 * Utility method which walls moveTo on this.canvas_ after transforming
 * dollarX and dollarY into canvas x/y coordinates.
 * @param {Number} dollarX
 * @param {Number} dollarY
 */
BreakPointChart.prototype.moveTo = function(dollarX, dollarY) {
  this.context_.moveTo(this.canvasX(dollarX), this.canvasY(dollarY));
};

/**
 *  Render the bounding box for our chart.
 */
BreakPointChart.prototype.renderBoundingBox = function() {
  this.context_.save();
  this.context_.lineWidth = 1;

  this.context_.beginPath();
  this.moveTo(0, 0);
  this.lineTo(0, this.maxRenderedYDollars());
  this.lineTo(this.maxRenderedXDollars(), this.maxRenderedYDollars());
  this.lineTo(this.maxRenderedXDollars(), 0);
  this.lineTo(0, 0);
  this.context_.stroke();

  this.context_.restore();
};

/**
 *  Render the breakpoint curves. These are constants.
 */
BreakPointChart.prototype.renderBreakPoints = function() {
  // Show the lines between the breakpoints. These are always the same.
  this.context_.save();
  this.context_.lineWidth = 4;

  this.context_.beginPath();
  this.moveTo(0, 0);

  var dollarX;
  var dollarY;

  // Origin to first bend point
  dollarX = this.taxEngine_.firstBendPoint();
  dollarY = this.taxEngine_.primaryInsuranceAmountForEarnings(dollarX);
  this.lineTo(dollarX, dollarY);

  // First to second bend point
  dollarX = this.taxEngine_.secondBendPoint();
  dollarY = this.taxEngine_.primaryInsuranceAmountForEarnings(dollarX);
  this.lineTo(dollarX, dollarY);

  // Second to third bend point
  dollarX = this.maxRenderedXDollars();
  dollarY = this.taxEngine_.primaryInsuranceAmountForEarnings(dollarX);
  this.lineTo(dollarX, dollarY);

  this.context_.stroke();

  this.context_.restore();
};


/**
 * Renders a rectangle with three rounded corners.
 * @param {Number} x canvas x coordinate to draw upper-left corner.
 * @param {Number} y canvas y coordinate to dray upper-left corner.
 * @param {Number} width of rectangle
 * @param {Number} height of rectangle
 * @param {Number} cornerRadius
 * @param {Number} squaredCorner (1 = upper left, then clockwise)
 */
BreakPointChart.prototype.roundedBox =
    function(x, y, width, height, cornerRadius, squaredCorner) {
  this.context_.save();
  this.context_.beginPath();
  this.context_.lineCap = 'square';

  if (squaredCorner === 1) {
    this.context_.moveTo(x, y);
  } else {
    this.context_.moveTo(x + cornerRadius, y);
  }
  if (squaredCorner === 2) {
    this.context_.lineTo(x + width, y);
  } else {
    this.context_.lineTo(x + width - cornerRadius, y);
    this.context_.arcTo(x + width, y,
                        x + width, y + cornerRadius,
                        cornerRadius);
  }
  if (squaredCorner === 3) {
    this.context_.lineTo(x + width, y + height);
  } else {
    this.context_.lineTo(x + width, y + height - cornerRadius);
    this.context_.arcTo(x + width, y + height,
                        x + width - cornerRadius, y + height,
                        cornerRadius);
  }
  if (squaredCorner === 4) {
    this.context_.lineTo(x, y + height);
  } else {
    this.context_.lineTo(x + cornerRadius, y + height);
    this.context_.arcTo(x, y + height,
                        x, y + height - cornerRadius,
                        cornerRadius);
  }
  if (squaredCorner === 1) {
    this.context_.lineTo(x, y);
  } else {
    this.context_.lineTo(x, y + cornerRadius);
    this.context_.arcTo(x, y,
                        x + cornerRadius, y,
                        cornerRadius);
  }

  this.context_.fill();
  this.context_.stroke();
  this.context_.restore();
};

/**
 * Renders a point on the breakpoint curve.
 * @param {earningsX} earnings dollar value which a point is rendered for.
 */
BreakPointChart.prototype.renderEarningsPoint = function(earningsX) {
  this.context_.save();

  // Where on the breakpoint 'curve' the user's benefit values lie.
  var userSSA = {
    x: Math.floor(earningsX),
    y: Math.floor(this.taxEngine_.primaryInsuranceAmountForEarnings(earningsX)),
  };

  // Add dollar sign and commas for better looking formatting.
  userSSA.xText = ('$' + userSSA.x).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
  userSSA.yText = ('$' + userSSA.y).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");

  // Thin dashed lines out from the user benefit point
  this.context_.lineWidth = 2;
  this.context_.lineCap = 'butt';
  this.context_.setLineDash([3, 5]);

  // Both lines starting at the point and radiating out makes a nifty
  // animation affect with the dashed lines at the edges of the chart.
  this.context_.beginPath();
  this.moveTo(userSSA.x, userSSA.y);
  this.lineTo(userSSA.x, 0);
  this.context_.stroke();
  
  this.context_.beginPath();
  this.moveTo(userSSA.x, userSSA.y);
  this.lineTo(this.maxRenderedXDollars(), userSSA.y);
  this.context_.stroke();

  // White filled circle with black edge showing the user benefit point.
  this.context_.setLineDash([]);  // Disable the dashed line from above.
  this.context_.fillStyle = this.context_.strokeStyle;

  this.context_.beginPath();
  this.context_.arc(
      this.canvasX(userSSA.x),
      this.canvasY(userSSA.y),
      /*radius=*/ 5,
      /*startAngle=*/ 0,
      /*endAngle=*/ 2 * Math.PI);
  this.context_.fill();
  this.context_.stroke();

  // Text at the edges showing the actual values, white on colored chip.

  // TODO: Low Priority. Switch which edge of the chip the dotted line
  // intersects with so as to avoid the two chips ever overlapping.

  // Chip on the bottom edge
  this.roundedBox(this.canvasX(userSSA.x), this.canvasY(0),
                  this.context_.measureText(userSSA.xText).width + 6, 19,
                  5, /*squaredCorner=*/ 1);
  // Chip on the right edge
  this.roundedBox(this.canvasX(this.maxRenderedXDollars()) + 1,
                  this.canvasY(userSSA.y),
                  this.context_.measureText(userSSA.yText).width + 6, 19,
                  5, /*squaredCorner=*/ 1);

  this.context_.fillStyle = 'white'
  this.context_.fillText(  // Text on the bottom edge.
      userSSA.xText,
      this.canvasX(userSSA.x) + 2,
      this.canvasY(0) + 15);
  this.context_.fillText(  // Text on the right edge.
      userSSA.yText, 
      this.canvasX(this.maxRenderedXDollars()) + 3,
      this.canvasY(userSSA.y) + 15);

  this.context_.restore();
}

/** Render the breakpoint chart. */
BreakPointChart.prototype.render = function() {
  // Canvas tutorial:
  // http://www.html5canvastutorials.com/tutorials/html5-canvas-element/
  this.context_.save();
  this.context_.clearRect(0, 0, this.canvas_.width, this.canvas_.height);
  
  this.context_.strokeStyle = '#666';
  this.renderBoundingBox();
  this.renderBreakPoints();
  this.context_.strokeStyle = '#5cb85c';

  this.renderEarningsPoint(this.taxEngine_.monthlyIndexedEarnings);

  this.context_.restore();
};

/** Toggles on/off functionality of mouseMoveListener. */
BreakPointChart.prototype.mouseClickListener = function() {
  var self = this;
  return function(e) {
    if (self.mouseToggle === 'ON') {
      self.mouseToggle = 'OFF'
    } else {
      self.mouseToggle = 'ON'
      // Immediately trigger a rendering based on mouse location.
      self.mouseMoveListener()(e);
    }
  };
}

/** Renders a 2nd earnings value based on mouse location. */
BreakPointChart.prototype.mouseMoveListener = function() {
  var self = this;
  return function(e) {
    if (self.mouseToggle == 'OFF')
      return;

    self.render();

    self.context_.save();
    self.context_.strokeStyle = '#337ab7';
    var canvasX = e.clientX - self.canvas_.getBoundingClientRect().left;
    self.renderEarningsPoint(self.earningsX(canvasX));
    self.context_.restore();
  };
}
