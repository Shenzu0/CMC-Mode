const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure session store
const store = new MongoDBStore({
    uri: 'mongodb://localhost:27017/shop',
    collection: 'sessions'
});

store.on('error', (error) => {
    console.log(error);
});

app.use(session({
    secret: 'votre_secret',
    resave: false,
    saveUninitialized: false,
    store: store
}));

// MySQL Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cms_mode'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        throw err;
    }
    console.log('Connected to MySQL database');
});

// MongoDB Database connection
mongoose.connect('mongodb://localhost:27017/shop').then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
});

const productSchema = new mongoose.Schema({
    title: String,
    description: String,
    imageUrl: String,
    category: String,
    comments: [{ name: String, text: String }]
});

const Product = mongoose.model('Product', productSchema);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Ensure the 'uploads' directory is served statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// User login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Database error');
        } else if (results.length > 0) {
            req.session.admin = true;
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    });
});

// User logout
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to logout:', err);
            res.status(500).send('Failed to logout');
        } else {
            res.json({ success: true });
        }
    });
});

app.use((req, res, next) => {
    if (req.path.startsWith('/admin') && !req.session.admin) {
        res.status(401).send('Non autorisé');
    } else {
        next();
    }
});

// Save content
app.post('/save-content', (req, res) => {
    const { id, content } = req.body;
    const query = 'REPLACE INTO content (element_id, content) VALUES (?, ?)';
    db.query(query, [id, content], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Database error');
        } else {
            res.status(200).send('Content saved');
        }
    });
});

// Get content
app.get('/get-content/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT content FROM content WHERE element_id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Database error');
        } else if (result.length > 0) {
            res.status(200).json({ content: result[0].content });
        } else {
            res.status(404).send('Content not found');
        }
    });
});

// Upload image
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (req.file) {
        const imageUrl = `/uploads/${req.file.filename}`;
        const { id } = req.body;

        // Update the database with the new image URL
        const query = 'REPLACE INTO content (element_id, content) VALUES (?, ?)';
        db.query(query, [id, imageUrl], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                res.status(500).send('Database error');
            } else {
                console.log('File uploaded successfully:', req.file);
                res.json({ success: true, filePath: imageUrl });
            }
        });
    } else {
        res.status(400).send('No file uploaded');
    }
});

// Upload background image
app.post('/upload-background-image', upload.single('image'), (req, res) => {
    if (req.file) {
        const imageUrl = `/uploads/${req.file.filename}`;
        const { section } = req.body;

        // Save the background image path to the database
        const query = 'REPLACE INTO background_images (section_id, image_url) VALUES (?, ?)';
        db.query(query, [section, imageUrl], (err, result) => {
            if (err) {
                console.error('Database error:', err);
                res.status(500).send('Database error');
            } else {
                console.log('Background image uploaded successfully:', req.file);
                res.json({ success: true, filePath: imageUrl });
            }
        });
    } else {
        res.status(400).send('No file uploaded');
    }
});

// Get background images
app.get('/get-background-images', (req, res) => {
    const query = 'SELECT * FROM background_images';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send('Database error');
        } else {
            const images = {};
            result.forEach(row => {
                images[row.section_id] = row.image_url;
            });
            res.json(images);
        }
    });
});

// Get all products by category
app.get('/api/products/:category', async (req, res) => {
    const { category } = req.params;
    const products = await Product.find({ category });
    res.json(products);
});

// Add a new product
app.post('/api/products', upload.single('image'), async (req, res) => {
    const { title, description, category } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const newProduct = new Product({ title, description, imageUrl, category });
    await newProduct.save();
    res.json(newProduct);
});

// Update a product
app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { title, description, category } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;
    const updatedProduct = await Product.findByIdAndUpdate(id, { title, description, imageUrl, category }, { new: true });
    res.json(updatedProduct);
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.json({ message: 'Product deleted' });
});

// Get all articles
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await Product.find();
        res.json(articles);
    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Add a new article
app.post('/api/articles', upload.single('image'), async (req, res) => {
    const { title, description } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const newArticle = new Product({ title, description, imageUrl });
    await newArticle.save();
    res.json(newArticle);
});

// Add a new comment to an article
app.post('/api/articles/:id/comments', async (req, res) => {
    const { id } = req.params;
    const { name, text } = req.body;
    const article = await Product.findById(id);
    if (article) {
        article.comments.push({ name, text });
        await article.save();
        res.json(article);
    } else {
        res.status(404).send('Article not found');
    }
});

// Delete a comment from an article
app.delete('/api/articles/:id/comments/:commentId', async (req, res) => {
    const { id, commentId } = req.params;
    const article = await Product.findById(id);
    if (article) {
        article.comments = article.comments.filter(comment => comment._id.toString() !== commentId);
        await article.save();
        res.json(article);
    } else {
        res.status(404).send('Article not found');
    }
});

// Delete an article
app.delete('/api/articles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await Product.findByIdAndDelete(id);
        res.json({ message: 'Article deleted' });
    } catch (error) {
        console.error('Internal Server Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve specific HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/shop.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'shop.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/contact.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/faq.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'faq.html'));
});

app.get('/blog.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/product-detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'product-detail.html'));
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
