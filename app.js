const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser=require('cookie-parser');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 1 * 10 * 1000, //10 secunde
	max: 5,
	standardHeaders: true, 
	legacyHeaders: false, 
});

const bodyParser = require('body-parser')
const app = express();
const port = 6789;

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
var db;

function OpenDBConnection()
{
    db = new sqlite3.Database('./ProiectPW.db', (err) => {
        if (err) {
          console.error(err.message);
        }
        console.log('Conectat cu succes la baza de date.');
      });
}
OpenDBConnection();

// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
// Folosim cookieParser
app.use(cookieParser());
app.use('/autentificare', loginLimiter);

var sessions = require('express-session')

app.use(sessions({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

var session;

// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
app.get('/', (req, res) => 
{
    var tableProducts = [];
    if(req.session.userId)
    {
        db.serialize(function () {
            db.all("select name from sqlite_master where type='table'", function (err, tables) {
                if(tables.length != 0)
                {
                    db.all("select * from produse", (err, products) => {
                        products.forEach((row) => {
                            tableProducts.push(row);
                        });

                        res.render('index', {username: req.session.userId, table: tableProducts, tableLength: tableProducts.length});
                    });  
                }
                else 
                {
                    res.render('index', {username: req.session.userId, table: undefined, tableLength: 0});
                }
            });
        });
    }
    else
    res.render('index', {username: undefined, table: tableProducts, tableLength: 0});
});
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată
app.get('/chestionar', (req, res) => {
    listaIntrebari = require('./intrebari.json');
    // în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări
    res.render('chestionar', {intrebari: listaIntrebari});
});

app.post('/rezultat-chestionar', (req, res) => {
    var i = 0;
    var cnt = 0;
    var listaIntrebari = require('./intrebari.json');
    for(const r in req.body)
    {
        if (req.body[r] == listaIntrebari[i++].corect)
            cnt++;
    }
    res.send("Raspunsuri corecte: " + cnt + "<br><a href='/'>Mergi la pagina principala</a>");
});

app.get('/autentificare', (req, res) => {
    OpenDBConnection();

    if(req.session.mesajEroare != undefined)
        res.render('autentificare', {mesajEroare: req.session.mesajEroare} );
    else
        res.render('autentificare', {mesajEroare: undefined});
});

app.post('/verificare-autentificare', (req,res) => {

    const utilizatori = require('./utilizatori.json');

    utilizatori.forEach(x => {
        if(req.body["username"] == x.username && req.body["password"] == x.password)
        {
            session = req.session;
            session.userId = x.username;
            session.varsta = x.varsta;
            session.admin = x.admin;
            session.mesajEroare = undefined;
            res.redirect('/');
        }              
    });

    if(req.session.userId == undefined)
    {
        session = req.session;
        session.mesajEroare = "Credentiale gresite";
        res.redirect('/autentificare')
    }
});

app.get('/delogare', (req, res) => {
    req.session.destroy();

    if(db != undefined)
    {
        db.close((err) => {
            if (err) {
            return console.error(err.message);
            }
            console.log('Deconectat cu succes de la baza de date.');
        });
    }

    res.redirect('/');
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:` + port));

/* ================================= DATABASE ================================= */
app.get('/creare-bd', (req, res) => {

    const dataSql = fs.readFileSync('./createDatabase.sql').toString();
    const dataArr = dataSql.toString().split(');');

    db.serialize(() => {
        db.run('PRAGMA foreign_keys=OFF;');
        db.run('BEGIN TRANSACTION;');

        dataArr.forEach((query) => {
            try {
                if(query) {
                    query += ');';
                    db.run(query, (err) => {
                    if(err) 
                        throw err;
                    });

                    db.run('COMMIT;');
                }
            }
            catch (err)
            {
                console.log(err.message);
            }
            });
        
    });
    res.redirect('/');
});

app.get('/inserare-bd', (req, res) => {
    const dataSql = fs.readFileSync('./insertIntoDatabase.sql').toString();
    const dataArr = dataSql.toString().split(');');

    db.serialize(() => {
        db.run('PRAGMA foreign_keys=OFF;');
        db.run('BEGIN TRANSACTION;');

        dataArr.forEach((query) => {
            try {
                if(query) {
                    query += ');';
                    db.run(query, (err) => {
                        if(err) 
                            throw err;
                    });
                }
            }
            catch (err)
            {
                console.log(err.message);
                res.redirect('/');
            }
        });
        db.run('COMMIT;');
      });

      res.redirect('/');
});

app.get('/adaugare-cos', (req, res) => {
    var cartLocal = "";
    if(req.session.cart != undefined)
        cartLocal = req.session.cart;
    if(cartLocal == "")
        cartLocal += req.query.id;
    else
        cartLocal += "," + req.query.id;
    req.session.cart = cartLocal;
    console.log(req.session.cart);
    res.redirect('/');
});

app.get('/vizualizare-cos', (req, res) => {
    var listaProduse;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION;');
        var cartLocal = req.session.cart;
        if(cartLocal != undefined)
        {  
            db.all("select * from produse where product_id in (" + cartLocal + ");", function(err, prod) {
                listaProduse = prod;
                
                res.render('vizualizare-cos', {listaProduse: listaProduse, username: req.session.userId});
            });
        }
        db.run('COMMIT;');
    });

    if(req.session.cart == undefined)
        res.render('vizualizare-cos', {listaProduse: undefined});
});

app.get('/scoatere-cos', (req, res) => {
    var cartLocal = req.session.cart;
    var products = cartLocal.split(',');
    var aux = [];
    for(var i = 0; i < products.length; i++)
    {
        if(products[i] != req.query.id)
            aux.push(products[i]);
    }

    req.session.cart = aux.join(',');
    res.redirect('/vizualizare-cos');
});

app.get('/admin', (req, res) => {
    if(req.session.admin == false)
        res.redirect('/');
    else
    {
        res.render('admin', {username: req.session.userId});
    }
});

app.post('/add-product', (req, res) => {
    var name = req.body.product_name;
    var quantity = req.body.quantity;
    var price = req.body.price;
    var manufacturer = req.body.manufacturer;
    var code = req.body.product_code;

    db.serialize(function() {
        db.all("SELECT product_id FROM produse ORDER BY product_id DESC LIMIT 1", (err, index) => {
            console.log(index[0].product_id);
            var sql = "INSERT INTO produse VALUES(" + (parseInt(index[0].product_id) + 1) + ",'" + 
            name+"',"+quantity+","+price+",'"+manufacturer+"','"+code+"');";
            console.log(sql);
            db.run(sql);
        });


    });

    res.redirect('/admin');
});

app.use(function(req, res, next) {
    res.status(404);
  
    if (req.accepts('html')) {
      res.render('404', { url: req.url });
      return;
    }

  });