//Requirements
const express = require('express');
const mysql = require('mysql');
const cookieParser = require("cookie-parser");
const util = require('util');
const moment = require('moment');


var error_message = "";
var mysql_err=true;

//init Express
const app = express();

app.use('/css', express.static('views/css'));
app.use(cookieParser());
app.use(auth);
app.use(getUserdata);


app.set('view engine', 'ejs');

let database = connectDatabase();

const query = util.promisify(database.query).bind(database);

//Function for default web path
app.get('/', (req, res) =>{
    res.render('landing', {
        displayName: res.displayName,
        userID: res.userID,
        cookie: res.cookie,
        first_login: res.first_login,
        last_login: res.last_login,
        cookie_expiry: res.expiry_date
        });
})



//Start Webserver
app.listen('80', () => {
    console.log('Server started');
});

//Function to (re)start MySQL Database connection
function connectDatabase(){
    //Connect to Database
    var database = mysql.createConnection({
        host:"DB_HOST",
        user: "DB_USERNAME",
        password: "DB_PASSWORD",
        database: "ttk"
    });

    database.connect(function(err){
        if(err){
            console.log("Database Error");
            mysql_err=true;
        }else{
            console.log("Database Connected!");
            mysql_err=false;
        }
    });
    database.on('error', function(err){
        console.log("database error");
        mysql_err=true;
    });
    return database;
}

//Auth function with cookie
async function auth(req, res, next){
    if(!('ttk_cookie' in req.cookies)){
        console.log("no cookie found");
        res = await newCookie(req, res);
    }else{
        //check cookie
        
        var user_row = await checkCookie(req.cookies.ttk_cookie);
        
        if(user_row == undefined){
            //bad cookie
            res = await newCookie(req, res);
        }else{
            //good cookie
            res.userID = user_row.userID;
            res.expiry_date = user_row.expiry_date;
            //refresh cookie
            res = await newCookie(req, res, res.userID);
        }
    }
    await res;
    next();
}

//function to check cookie
async function checkCookie(cookie){
    sql = "SELECT * FROM `cookie` WHERE `cookie` = '"+cookie+"'";
    var rows = await query(sql);
    if(rows.length == 0){
        console.log("no people found");
        return;
    }else{
        return rows[0];
    }
}

//fuction to get Userdata from MySQL
async function getUserdata(req, res, next){
    data = await query("SELECT * FROM `users` WHERE `userID` = '"+res.userID+"'");
    if(data[0] != undefined){
        res.first_login = data[0].creation_date;
        res.displayName = data[0].displayName;
    }
    next();
}

//function when new cookie is needed
async function newCookie(req, res, userID){
    var date = Date.now();
    date+=24 * 60 * 60 * 1000*100;
    var new_date = new Date(date);
    
    var cookie = generateRandomString(25);

    sql = "SELECT * FROM `cookie` WHERE `cookie` = '"+cookie+"'";
    await database.query(sql, function(err, result){
        
        if(err) mysql_err=true;
        if(result[0] !== undefined){
            cookie=undefined;
        }
    });
    
    res.cookie('ttk_cookie' , await cookie, {maxAge: 24 * 60 * 60 * 1000*100});
    res.new_cookie=await cookie;

    //REFRESH
    if(userID === undefined){
        var userID="anon:"+generateRandomString(28);
        res.userID = userID;
        sql = "INSERT INTO users (userID, displayName, last_login, creation_date) VALUES ('"+userID+"', 'Anonymous User', '"+moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')+"', '"+moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')+"')";
        await database.query(sql, function(err, result){
            if(err){
                console.log(err);
                mysql_err=true;
            }
        });
    }else{
        res.userID = userID;
        await query("UPDATE `users` SET `last_login`='"+moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')+"' WHERE `userID` = '"+userID+"';")
        await query("DELETE FROM `cookie` WHERE `cookie` = '"+req.cookies.ttk_cookie+"'");
    }
    res.last_login = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
    //send cookie to database
    sql = "INSERT INTO cookie (userID, cookie, expiry_date, issue_date) VALUES ('"+userID+"', '"+cookie+"', '"+moment(date).format('YYYY-MM-DD HH:mm:ss')+"', '"+moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')+"')";
    await database.query(sql, function(err, result){
        if(err){
            console.log(err);
            mysql_err=true;
        }
    });
    res.cookie = cookie;
    return await res;
}

//function to generate random strings
const generateRandomString = (myLength) => {
    const chars =
      "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890";
    const randomArray = Array.from(
      { length: myLength },
      (v, k) => chars[Math.floor(Math.random() * chars.length)]
    );
  
    const randomString = randomArray.join("");
    return randomString;
};