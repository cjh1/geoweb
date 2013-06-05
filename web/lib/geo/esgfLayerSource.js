//////////////////////////////////////////////////////////////////////////////
/**
 * @module ogs.geo
 */
//////////////////////////////////////////////////////////////////////////////

/*jslint devel: true, forin: true, newcap: true, plusplus: true,
  white: true, indent: 2*/
/*global geoModule, ogs, inherit, $*/

//////////////////////////////////////////////////////////////////////////////
/**
 * esgfLayerSource provides data to a layer by downloading a dataset from
 * ESGF
 */
//////////////////////////////////////////////////////////////////////////////
geoModule.esgfLayerSource = function(url, vars) {

  if (!(this instanceof geoModule.esgfLayerSource) ) {
    return new geoModule.esgfLayerSource(url, vars);
  }
  geoModule.layerSource.call(this);

  var m_url = url,
      m_vars = vars;

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Should be implemented by a concrete class
   */
  ////////////////////////////////////////////////////////////////////////////
  this.getData = function(time, callback) {
    console.log("getData");
    var asyncVal = false,
        retVal = [];

    if (callback) {
      asyncVal = true;
    }

    $.ajax({
      type: 'POST',
      url: '/esgf/read',
      data: {
        url: m_url,
        vars: vars,
        time: time
      },
      dataType: 'json',
      async: asyncVal,
      success: function(response) {
        if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
        } else {
          var reader = ogs.vgl.geojsonReader();
          retVal = reader.readGJObject(jQuery.parseJSON(response.result.data[0]));
        }
      }
    });

    if (callback) {
      callback(retVal);
    }
    return retVal;
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Should be implemented by a concrete class
   */
   ////////////////////////////////////////////////////////////////////////////
  this.getMetaData = function(time) {
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Should be implemented by a concrete class
   */
  ////////////////////////////////////////////////////////////////////////////
  this.getTimeRange = function(callback) {
    var timeRange = [];
    var asyncVal = false;

    if (callback) {
      asyncVal = true;
    }

    $.ajax({
      type: 'POST',
      url: '/data/esgf/query',
      data: {
        expr: m_name,
        vars: m_vars,
        fields: ['timerange']
      },
      dataType: 'json',
      async: asyncVal,
      success: function(response) {
        if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
        } else {
          // TODO implement this
          return null;
        }
      }
    });
  };

  ////////////////////////////////////////////////////////////////////////////
  /**
   * Should be implemented by a concrete class
   */
  ////////////////////////////////////////////////////////////////////////////
  this.getSpatialRange = function() {
  };

  return this;
};

inherit(geoModule.esgfLayerSource, geoModule.layerSource);