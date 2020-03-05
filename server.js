
var express = require("express");
var expHandlebars = require("express-handlebars");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");
var axios = require("axios");
var cheerio = require("cheerio");

// Requiring models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");


var port = process.env.PORT || 3000
var app = express();

// Use morgan and body parser with our app
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// static directory
app.use(express.static("public"));



app.engine("handlebars", expHandlebars({
  defaultLayout: "main",
  partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");



// Database configuration - mongoose

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

mongoose.connect(MONGODB_URI, { useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: true });
var db = mongoose.connection;


db.on("error", function (error) {
  console.log("Mongoose Error: ", error);
});

db.once("open", function () {
  console.log("Mongoose connection successful.");
});

// Routes

//GET requests to render Handlebars pages
app.get("/", function (req, res) {
  Article.find({ "saved": false }, function (error, data) {
    if (data.length === 0 || error) {
      res.render('error', { errorMsg: "Error blah blah" })
    }
  })
    .then(function (results) {
      var hsbObject = {
        article: results
      };
      console.log(hsbObject);
      res.render("home", hsbObject);

    })
});

app.get("/saved", function (req, res) {
  Article.find({ "saved": true }).populate("notes").exec(function (error, articles) {
    var hsbObject = {
      article: articles
    };
    res.render("saved", hsbObject);
  });
});


app.get("/scrape", function (req, res) {
  axios.get("https://sf.curbed.com/").then(function (response) {
    var $ = cheerio.load(response.data);
    $("div.c-entry-box--compact__body").each(function (i, element) {


      var result = {
        title: "",
        author: "",
        summary: "",
        link: ""
      };


      result.title = $(this).find("h2.c-entry-box--compact__title").text();
      result.author = $(this).find("span.c-byline__author-name").text();
      result.summary = $(this).find("p.c-entry-box--compact__dek").text();
      var link = $(this).find("h2.c-entry-box--compact__title").find("a").attr("href");
      result.link = link;
      console.log('link:', result.link);


      var newArticle = new Article(result);

      // console.log("new article", newArticle)




      // New Article 
      newArticle.save(function (err, doc) {
        if (err) {
          console.log(err);
        }
        else {
        }
      });

    });
    res.send("Articles successfully scraped");
  });
});

// adding articles from the mongoDB
app.get("/articles", function (req, res) {
  Article.find({}, function (error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      res.json(doc);
    }
  });
});


app.get("/articles/:id", function (req, res) {
  Article.findOne({ "_id": req.params.id })
    .populate("note")
    .exec(function (error, doc) {
      if (error) {
        console.log(error);
      }
      else {
        res.json(doc);
      }
    });
});


// Save
app.post("/articles/save/:id", function (req, res) {
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true })
    .exec(function (error, doc) {
      if (error) {
        console.log(error);
      }
      else {
        res.send(doc);
      }
    });
});

// Drop
app.post("/articles/delete/:id", function (req, res) {
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": false, "notes": [] })
    .exec(function (error, doc) {
      if (error) {
        console.log(error);
      }
      else {
        res.send(doc);
      }
    });
});


// New note
app.post("/notes/save/:id", function (req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  // saving to db
  newNote.save(function (error, note) {
    if (error) {
      console.log(error);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.id }, { $push: { "notes": note } })
        .exec(function (error) {
          if (error) {
            console.log(error);
            res.send(error);
          }
          else {
            res.send(note);
          }
        });
    }
  });
});

// Delete note
app.delete("/notes/delete/:note_id/:article_id", function (req, res) {
  Note.findOneAndRemove({ "_id": req.params.note_id }, function (error) {
    if (error) {
      console.log(error);
      res.send(error);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, { $pull: { "notes": req.params.note_id } })
        .exec(function (error) {
          if (error) {
            console.log(error);
            res.send(error);
          }
          else {
            res.send("Note Deleted");
          }
        });
    }
  });
});

// Listen on port
app.listen(port, function () {
  console.log("App live on port " + port);
});