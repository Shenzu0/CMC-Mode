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

// Middleware de vérification de session
app.use((req, res, next) => {
    if (req.path.startsWith('/admin') && !req.session.admin) {
        return res.status(401).send('Non autorisé');
    }
    next();
});

// Route pour vérifier la session
app.get('/check-session', (req, res) => {
    res.json({ isAdmin: !!req.session.admin });
});

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

// Define product schema and model
const productSchema = new mongoose.Schema({
    title: String,
    description: String,
    imageUrl: String,
    category: String,
    comments: [{ name: String, text: String }]
});

const Product = mongoose.model('Product', productSchema);

// Define FAQ schema and model
const faqSchema = new mongoose.Schema({
    question: String,
    answer: String,
    category: String
});

const FAQ = mongoose.model('FAQ', faqSchema);

// Ensure the 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Route pour l'upload des fichiers
app.post('/upload', upload.single('file'), (req, res) => {
    console.log(req.file);
    if (req.file) {
        res.json({ fileUrl: `/uploads/${req.file.filename}` });
    } else {
        res.status(400).send('File upload failed');
    }
});

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
            console.log('User logged out successfully');
            res.json({ success: true });
        }
    });
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

// Get a product by ID
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).send('Produit non trouvé');
        }
        res.json(product);
    } catch (error) {
        console.error('Erreur lors de la récupération du produit:', error);
        res.status(500).send('Erreur serveur');
    }
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
    console.log('PUT request received for product ID:', id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid product ID');
    }

    const { title, description } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { title, description, imageUrl },
            { new: true }
        );
        if (!updatedProduct) {
            return res.status(404).send('Produit non trouvé');
        }
        res.json(updatedProduct);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du produit:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid product ID');
    }

    try {
        await Product.findByIdAndDelete(id);
        res.json({ message: 'Product deleted' });
    } catch (error) {
        console.error('Erreur lors de la suppression du produit:', error);
        res.status(500).send('Erreur serveur');
    }
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

// FAQ Routes

// Get all FAQs
app.get('/api/faqs', async (req, res) => {
    try {
        const faqs = await FAQ.find();
        res.json(faqs);
    } catch (error) {
        console.error('Erreur lors de la récupération des FAQs:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Add a new FAQ
app.post('/api/faqs', async (req, res) => {
    const { question, answer, category } = req.body;
    const newFAQ = new FAQ({ question, answer, category });
    try {
        await newFAQ.save();
        res.json(newFAQ);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la FAQ:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Update an FAQ
app.put('/api/faqs/:id', async (req, res) => {
    const { id } = req.params;
    const { question, answer, category } = req.body;
    try {
        const updatedFAQ = await FAQ.findByIdAndUpdate(id, { question, answer, category }, { new: true });
        if (!updatedFAQ) {
            return res.status(404).send('FAQ non trouvée');
        }
        res.json(updatedFAQ);
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la FAQ:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Delete an FAQ
app.delete('/api/faqs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await FAQ.findByIdAndDelete(id);
        res.json({ message: 'FAQ supprimée' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la FAQ:', error);
        res.status(500).send('Erreur serveur');
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
