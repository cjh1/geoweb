// Disable console log
// console.log = function() {}

var archive = {};
archive.myMap = null;
archive.streamId = null;
archive.ignoreResults = false;
archive.performingLocalQuery = false;
archive.performingESGFQuery = false;

archive.getMongoConfig = function() {
  "use strict";
    return {
      server:localStorage.getItem('archive:mongodb-server') || 'localhost',
      database:localStorage.getItem('archive:mongodb-database') || 'documents',
      collection:localStorage.getItem('archive:mongodb-collection') || 'files'
    }
};

archive.init = function() {
  $('#from').datepicker();
  $('#to').datepicker();

  // update class to add processing spinner
  $('#query-input').bind("keyup", function() {
    query = $('#query-input').val();
    if (0 == query.length) {
      if (archive.streamId)
        archive.cancelStream(archive.streamId);
        archive.ignoreResults = true;

      $('#query-input').removeClass("query-in-progress");
      $('#document-table-body').empty();
    }
    else {
      archive.ignoreResults = false;
      $('#query-input').addClass("query-in-progress");
      archive.performingESGFQuery = true;
      archive.performingLocalQuery = true;
      
      if ($('#local').filter('.active').length == 1)
        archive.query(query);

      if ($('#esgf').filter('.active').length == 1) {
        if (archive.streamId)
          archive.cancelStream(archive.streamId)
        archive.streamId = null;
        archive.esgfQuery(query);
      }
        
    }
  })

  $('#glcanvas').droppable({
    drop: function(event, ui) {

      archive.addLayer($(ui.helper).data("dataset"));
    }
  });


}

archive.processLocalResults = function(results, remove) {
  remove = typeof remove !== 'undefined' ? remove : false;

  removeFilter = function(d) {return false};
  if (remove) {
    removeFilter = function(d) {return d['source'] == 'Local'};
  }

  archive.processResults(results, removeFilter);

}

archive.processESGFResults = function(results, remove) {
  remove = typeof remove !== 'undefined' ? remove : false;

  removeFilter = function(d) {return false};
  if (remove) {
    removeFilter = function(d) {return d['source'] == 'ESGF'};
  }

  archive.processResults(results, removeFilter);
}

archive.processResults = function(results, removeFilter) {

  if (archive.ignoreResults)
    return;

  var tr = d3.select('#document-table-body').selectAll("tr")
    .data(results, function(d) {
      return d['id'];
    });

  var rows = tr.enter().append('tr');
  //.property('id', function(d) {
  //  return d['id'];
  //});

  $.each(tr.exit()[0], function(index, row) {

    if (row) {
      selection = d3.select(row);
      if (removeFilter(selection.data()[0]))
        selection.remove();
    }
  });

  var td = rows.selectAll('td')
    .data(function(row) {
      // Display the tags, we should probably truncate the list ...
      var tags = []
      $.each(row['variables'], function(index, variable) {
        tags = tags.concat(variable['tags']);
      });


      return [row['name'], row['source'], tags.join()] ;
    });

   td.enter().append('td').text(function(d) { return d; });

  // Populate the parameter list
  var select = rows.append('select');

  select = select.selectAll('select').data(function(row) {
    var variables = [];
    $.each(row['variables'], function(index, variable) {
      variables = variables.concat(variable['name']);
    });

    return variables;
  });

  select.enter().append('option').text(function(variable) {
    console.log("v: " + variable)
    return variable;
  });
  select.exit().remove();

  $('tr').draggable( {
    cursor: 'move',
    containment: 'window',
    appendTo: 'body',
    helper: function(event) {

    var parameter = $('> select', this).val();

    var data = d3.select(this).data();

    drag = $('<div class="whatadrag"><img src="1369422679_database.png"/><div id="parameter" style="position: relative; top: -70px; right: -50px;"><b>' + parameter + '<b></div></div>');

    drag.data("dataset", {
      name: data[0].name,
      dataset_id: data[0].id,
      source: data[0].source,
      parameter: parameter,
      url: data[0].url,
      basename: data[0].basename
    });

    return drag;
    }
  })

  if (archive.isQueryComplete())
    $('#query-input').removeClass("query-in-progress");
}

archive.isQueryComplete = function() {
  return !archive.performingLocalQuery && !archive.performingESGFQuery;
}

archive.query = function(query) {

  archive.performingLocalQuery = true;

  mongo = archive.getMongoConfig();

  queryTerms = query.split(" ")
  or = []
  $.each(queryTerms, function(index, value) {
    if (value.length != 0)
      or[index] = {tags: {$regex: '.*' + value +'.*', $options: 'i'}};
  });

  mongoQuery = {variables: {$elemMatch: { $or: or}}}

  console.log(JSON.stringify(mongoQuery));

  $.ajax({
    type: 'POST',
    url: '/mongo/' + mongo.server + '/' + mongo.database + '/' + mongo.collection,
    data: {
      query: JSON.stringify(mongoQuery),
      limit:100,
      fields: JSON.stringify(['name', 'basename', 'variables'])
    },
    dataType: 'json',
    success: function(response) {
      if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
      } else {

        // Convert _id.$oid into id field, this transformation is do so the
        // data is in the same for as other sources. Also add the source.
        $.each(response.result.data, function(index, row) {
          row['id'] = row['_id'].$oid;
          row['source'] = "Local";
        });

        console.log(response.result.data);

        archive.processLocalResults(response.result.data, true);
        archive.performingLocalQuery = false;
        //ogs.ui.gis.createDataList('documents', 'Documents', 'table-layers', response.result.data, archive.addLayer);
      }
    }
  });
}

archive.nextResult = function (streamId, remove) {
  remove = typeof remove !== 'undefined' ? remove : false;

  $.ajax({
    type: 'POST',
    url: '/esgf/stream',
    data: {
      streamId: streamId
    },
    dataType: 'json',
    success: function(response) {
      if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
      } else {

        // Set the source

        if (response.result.data) {
          $.each(response.result.data, function(index, row) {
            row['source'] = "ESGF";
          });
          console.log(response.result.data);
          archive.processESGFResults(response.result.data, remove);
        }

        if (response.result.hasNext) {
          setTimeout(function() {archive.nextResult(streamId)}, 0);
        }
        else {
          archive.performingESGFQuery = false;
          if (archive.isQueryComplete())
            $('#query-input').removeClass("query-in-progress");
        }
      }
    }
  });
}

archive.cancelStream = function (streamId) {

  $.ajax({
    type: 'POST',
    url: '/esgf/stream',
    data: {
      streamId: streamId,
      cancel: true
    },
    dataType: 'json',
    success: function(response) {
      if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
      }
      archive.performingESGFQuery = false;
    }
  });
}

archive.esgfQuery = function(query) {
  archive.performingESGFQuery = true;

  $.ajax({
    type: 'POST',
    url: '/esgf/query',
    data: {
      expr: JSON.stringify(query)
    },
    dataType: 'json',
    success: function(response) {
      if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
      } else {

        if (response.result.hasNext) {
          archive.streamId = response.result.streamId;
          archive.nextResult(response.result.streamId, true);
        }
      }
    }
  });
}


/**
 * Main program
 *
 */
archive.main = function() {

  archive.init();

  var mapOptions = {
    zoom : 6,
    center : ogs.geo.latlng(0.0, 0.0),
    source: '/data/land_shallow_topo_2048.png',
    country_boundaries: true
  };

  archive.myMap = ogs.geo.map(document.getElementById("glcanvas"), mapOptions);

 // @note For testing only
 //  var planeLayer = ogs.geo.featureLayer({
 //    "opacity" : 1,
 //    "showAttribution" : 1,
 //    "visible" : 1
 //  }, ogs.geo.planeFeature(ogs.geo.latlng(-90.0, 0.0), ogs.geo.latlng(90.0,
 //                                                                     180.0)));
 // archive.myMap.addLayer(planeLayer);

  // Read city geo-coded data
  var table = [];
  var citieslatlon = [];
  var colors = [];
  $.ajax({
    type : "GET",
    url : "/data/cities.csv",
    dataType : "text",
    success : function(data) {
      table = archive.processCSVData(data);
      if (table.length > 0) {
        var i;
        for (i = 0; i < table.length; ++i) {
          if (table[i][2] != undefined) {
            var lat = table[i][2];
            lat = lat.replace(/(^\s+|\s+$|^\"|\"$)/g, '');
            lat = parseFloat(lat);

            var lon = table[i][3];
            lon = lon.replace(/(^\s+|\s+$|^\"|\"$)/g, '');
            lon = parseFloat(lon);
            citieslatlon.push(lon, lat, 0.0);
            colors.push(1.0, 1.0, 153.0 / 255.0);
          }
        }

        // Load image to be used for drawing dots
        var image = new Image();
        image.src = '/data/spark.png';
        image.onload = function() {
          var pointLayer = ogs.geo.featureLayer({
            "opacity" : 1,
            "showAttribution" : 1,
            "visible" : 1
          }, ogs.geo.pointSpritesFeature(image, citieslatlon, colors));
          pointLayer.setName('cities');
         archive.myMap.addLayer(pointLayer);
        };
      }
    }
  });

  $(function() {
    var canvas = document.getElementById('glcanvas');

    // Resize the canvas to fill browser window dynamically
    window.addEventListener('resize', resizeCanvas, false);

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      updateAndDraw(canvas.width, canvas.height);
    }
    resizeCanvas();

    function updateAndDraw(width, height) {
     archive.myMap.resize(width, height);
     archive.myMap.redraw();
    }

    // Fetch documents from the database
    archive.getDocuments();

    // Create a placeholder for the layers
    var layersTable = ogs.ui.gis.createList('layers', 'Layers');

    // Create a placeholder for layer controls
    var layersControlTable = ogs.ui.gis.createList('layer-controls', 'Controls');

    // Populate controls
    ogs.ui.gis.createControls(layersControlTable, archive.myMap);

    // Create a place holder for view controls
    // Create a placeholder for layer controls
    var viewControlTable = ogs.ui.gis.createList('view-controls', 'View-Options');

    // Generate options
    ogs.ui.gis.generateOptions(viewControlTable, archive.myMap);
  });

  init();
};


archive.processCSVData = function(csvdata) {
  var table = [];
  var lines = csvdata.split(/\r\n|\n/);

  for ( var i = 0; i < lines.length; i++) {
    var row = lines[i].split(',');
    table.push(row);
  }
  return table;
};


archive.getDocuments = function() {
  mongo = archive.getMongoConfig();
  $.ajax({
    type: 'POST',
    url: '/mongo/' + mongo.server + '/' + mongo.database + '/' + mongo.collection,
    data: {
      query: JSON.stringify({}),
      limit:100,
      fields: JSON.stringify(['name', 'basename', 'variables', 'temporalrange'])
    },
    dataType: 'json',
    success: function(response) {
      if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
      } else {
        //ogs.ui.gis.createDataList('documents', 'Documents', 'table-layers', response.result.data, archive.addLayer);
      }
    }
  });
};


archive.selectLayer = function(target, layerId) {
  var layer = archive. myMap.findLayerById(layerId);

  // See bootstrap issue: https://github.com/twitter/bootstrap/issues/2380
  if ($(target).attr('data-toggle') !== 'button') { // don't toggle if data-toggle="button"
      $(target).toggleClass('active');
    }

  if (layer != null) {
    if ($(target).hasClass('active')) {
      if (archive.myMap.selectLayer(layer)) {
        ogs.ui.gis.selectLayer(target, layerId);
        return true;
      }

      return false;
    }
    else {
      archive.myMap.selectLayer(null);
      ogs.ui.gis.selectLayer(null, null);
      return true;
    }
  }

  return false;
}


archive.toggleLayer = function(target, layerId) {
  var layer = archive.myMap.findLayerById(layerId);
  if (layer != null) {
    archive.myMap.toggleLayer(layer);
    archive.myMap.redraw();
    // @todo call ui toggle layer nows
    return true;
  }

  return false;
};


archive.removeLayer = function(target, layerId) {
  var layer = archive.myMap.findLayerById(layerId);
  if (layer != null) {
    archive.myMap.removeLayer(layer);
    archive.myMap.redraw();
    ogs.ui.gis.removeLayer(target, layerId);
    return true;
  }

  return false;
};

archive.addLayer = function(target) {

  var source = null;

  if (target.source == 'Local')
    source = ogs.geo.archiveLayerSource(JSON.stringify($(target).attr('basename')),
        JSON.stringify(target.parameter));
  else if (target.source == 'ESGF')
    source = ogs.geo.esgfLayerSource(JSON.stringify(target.url),
        JSON.stringify(target.parameter));
  else
    console.log("Unrecognized source");

  ogs.ui.gis.addLayer(archive, 'table-layers', target, archive.selectLayer,
    archive.toggleLayer, archive.removeLayer, function() {
    var widgetName, widget, timeval, varval;

    //figure out what time and variable were chosen
//    widgetName = $(target).attr('name') + '_tselect';
//    widget = document.getElementById(widgetName);
//    timeval = widget.options[widget.selectedIndex].text
//    widgetName = $(target).attr('name') + '_vselect';
//    widget = document.getElementById(widgetName);
//    varval = widget.options[widget.selectedIndex].text

    var layer = ogs.geo.featureLayer();
    layer.setName(target.name);
    layer.setDataSource(source);
    layer.update(JSON.stringify(timeval));
    archive.myMap.addLayer(layer);
    archive.myMap.redraw();
    ogs.ui.gis.layerAdded(target);
    $('.btn-layer').each(function(index){
              $(this).removeClass('disabled');
              $(this).removeAttr('disabled');
    });

    // $.ajax({
    //   type: 'POST',
    //   url: '/data/read',
    //   data: {
    //     expr: JSON.stringify($(event.target).attr('basename')),
    //     vars: JSON.stringify(varval),
    //     time: JSON.stringify(timeval)
    //   },
    //   dataType: 'json',
    //   success: function(response) {
    //     if (response.error !== null) {
    //       console.log("[error] " + response.error ? response.error : "no results returned from server");
    //     } else {
    //       var reader = ogs.vgl.geojsonReader();
    //       //var time0, time2, time3, time4;
    //       //time0 = new Date().getTime();
    //       var geoms = reader.readGJObject(jQuery.parseJSON(response.result.data[0]));
    //       //time1 = new Date().getTime();
    //       for (var i = 0; i < geoms.length; ++i) {
    //         var layer = ogs.geo.featureLayer({
    //           "opacity" : 0.5,
    //           "showAttribution" : 1,
    //           "visible" : 1
    //         }, ogs.geo.geometryFeature(geoms[i]));
    //         var layerId = $(event.target).attr('name');
    //         layer.setName(layerId);
    //         archive.myMap.addLayer(layer);
    //       }
    //       //time2 = new Date().getTime();
    //       archive.myMap.redraw();
    //       //time3 = new Date().getTime();

    //       //time4 = new Date().getTime();
    //       //console.log("vgl times: ", time1-time0, ",", time2-time1, ",", time3-time2, ",", time4-time3);


    //     }
    //   }
    // });

  });
};
