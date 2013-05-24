// Disable console log
// console.log = function() {}

var archive = {};
archive.myMap = null;

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
    console.log("down");
    query = $('#query-input').val();

    console.log(query.length)
    if (0 == query.length) {
      $('#query-input').removeClass("query-in-progress");
      $('#document-table-body').empty();
    }
    else {
      $('#query-input').addClass("query-in-progress");
      archive.query(query)
    }
  })

  $('#glcanvas').droppable({
    drop: function(event, ui) {

      console.log(ui.draggable);
      console.log(d3.select(ui.draggable).data());

      console.log($(ui.helper).data("dataset"))
    }
  });


}

archive.processResults = function(results) {
  var tr = d3.select('#document-table-body').selectAll("tr")
    .data(results, function(d) {
      return d['_id'].$oid;
    });

  var rows = tr.enter().append('tr');
  //.property('id', function(d) {
  //  return d['id'];
  //});
  tr.exit().remove();

  var td = rows.selectAll('td')
    .data(function(row) {
      // Display the tags, we should probably truncate the list ...
      var tags = []
      $.each(row['variables'], function(index, variable) {
        tags = tags.concat(variable['tags']);
      });


      return [row['name'], 'Local', tags.join()] ;
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
      dataset_id: data[0].id,
      source: data[0].source,
      parameter: parameter
    });

    return drag;
    }
  })

  $('#query-input').removeClass("query-in-progress");
}

archive.query = function(query) {
  console.log("mongo query")
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
          row['source'] = "Local"
        });

        archive.processResults(response.result.data);
        //ogs.ui.gis.createDataList('documents', 'Documents', 'table-layers', response.result.data, archive.addLayer);
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
      fields: JSON.stringify(['name', 'basename', 'variables'])
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


archive.addLayer = function(event) {
  ogs.ui.gis.addLayer(archive, 'table-layers', event.target, archive.selectLayer,
    archive.toggleLayer, archive.removeLayer, function() {
    $.ajax({
      type: 'POST',
      url: '/data/read',
      data: {
        expr: JSON.stringify($(event.target).attr('basename'))
      },
      dataType: 'json',
      success: function(response) {
        if (response.error !== null) {
          console.log("[error] " + response.error ? response.error : "no results returned from server");
        } else {
          var reader = ogs.vgl.geojsonReader();
          var geoms = reader.readGJObject(jQuery.parseJSON(response.result.data[0]));
          for (var i = 0; i < geoms.length; ++i) {
            var layer = ogs.geo.featureLayer({
              "opacity" : 0.5,
              "showAttribution" : 1,
              "visible" : 1
            }, ogs.geo.geometryFeature(geoms[i]));
            var layerId = $(event.target).attr('name');
            layer.setName(layerId);
            archive.myMap.addLayer(layer);
          }
          archive.myMap.redraw();
          ogs.ui.gis.layerAdded(event.target);

          $('.btn-layer').each(function(index){
              $(this).removeClass('disabled');
              $(this).removeAttr('disabled');
            }
          );
        }
      }
    });
  });
};
