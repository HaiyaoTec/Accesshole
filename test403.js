const app = require('express')();

app.get("/", (req, res) => {
    res.status(403)
    res.send('Hello World!')

})
app.listen(9999)