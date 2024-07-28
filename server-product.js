const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Ajouté pour analyser le JSON

mongoose.connect('mongodb://localhost:27017/shop').then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
});

const productSchema = new mongoose.Schema({
    title: String,
    description: String,
    detailDescription: String, 
    imageUrl: String,
    category: String,
    comments: [{ name: String, text: String }]
});


const Product = mongoose.model('Product', productSchema);

app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Received request for product ID: ${id}`);
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid product ID');
    }
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        console.log(`Found product: ${JSON.stringify(product)}`);
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Server error');
    }
});

app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`Received update request for product ID: ${id}`);
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send('Invalid product ID');
    }
    try {
        const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedProduct) {
            return res.status(404).send('Product not found');
        }
        console.log(`Updated product: ${JSON.stringify(updatedProduct)}`);
        res.json(updatedProduct);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Server error');
    }
});
// Get a product by ID
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findById(id, 'title imageUrl detailDescription');
        if (!product) {
            return res.status(404).send('Produit non trouvé');
        }
        res.json(product);
    } catch (error) {
        console.error('Erreur lors de la récupération du produit:', error);
        res.status(500).send('Erreur serveur');
    }
});

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/product-detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'product-detail.html'));
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});
