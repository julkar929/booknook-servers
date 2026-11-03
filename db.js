const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const INITIAL_BOOKS = [
  {
    title: "The Midnight Library",
    author: "Matt Haig",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80",
    description: "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.",
    copies: 5,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
  },
  {
    title: "Cosmos: A Personal Voyage",
    author: "Carl Sagan",
    category: "Science",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
    description: "A sweeping journey through space and time exploring the origins of knowledge, the scientific method, and our place in the cosmic ocean.",
    copies: 4,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6)
  },
  {
    title: "Sapiens: A Brief History of Humankind",
    author: "Yuval Noah Harari",
    category: "History",
    image: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=800&q=80",
    description: "From a minor ape to the dominant species on Earth, Sapiens explores how biology and history have defined us and enhanced our understanding of what it means to be human.",
    copies: 6,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5)
  },
  {
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    category: "Kids",
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
    description: "A poetic tale of a young prince who visits various planets in space, addressing themes of loneliness, friendship, love, and loss with childlike innocence.",
    copies: 7,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4)
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    category: "Others",
    image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80",
    description: "An easy and proven way to build good habits and break bad ones. Tiny changes that lead to remarkable, compounding life results.",
    copies: 8,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)
  },
  {
    title: "Project Hail Mary",
    author: "Andy Weir",
    category: "Science",
    image: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=800&q=80",
    description: "Ryland Grace is the sole survivor on a desperate, last-chance mission to save humanity from an extinction-level solar calamity. A masterclass in scientific problem-solving.",
    copies: 3,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)
  },
  {
    title: "Klara and the Sun",
    author: "Kazuo Ishiguro",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1532012164546-f432f2e3777f?auto=format&fit=crop&w=800&q=80",
    description: "The story of Klara, an Artificial Friend with outstanding observational qualities, who watches the behavior of those who come in to browse the store.",
    copies: 4,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1)
  },
  {
    title: "A Short History of Nearly Everything",
    author: "Bill Bryson",
    category: "Science",
    image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80",
    description: "Bill Bryson confronts his greatest challenge yet: to understand—and, if possible, answer—the oldest, biggest questions we have posed about the universe and ourselves.",
    copies: 5,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12)
  },
  {
    title: "Charlotte's Web",
    author: "E.B. White",
    category: "Kids",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80",
    description: "The heartwarming story of a little pig named Wilbur and his dear friend Charlotte, a clever spider who shows the true meaning of devotion and friendship.",
    copies: 6,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6)
  },
  {
    title: "Guns, Germs, and Steel",
    author: "Jared Diamond",
    category: "History",
    image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
    description: "A monumental work of geographic history exploring why societies developed differently across continents over the past 13,000 years.",
    copies: 3,
    userEmail: "librarian@booknook.org",
    userName: "BookNook Librarian",
    createdAt: new Date()
  }
];

class LocalCollection {
  constructor(name, dataStore, saveCallback) {
    this.name = name;
    this.dataStore = dataStore;
    this.saveCallback = saveCallback;
  }

  get items() {
    if (!this.dataStore[this.name]) {
      this.dataStore[this.name] = [];
    }
    return this.dataStore[this.name];
  }

  find(query = {}) {
    let results = this.items.filter(item => {
      for (const key of Object.keys(query)) {
        if (key === '_id') {
          const queryId = query._id?.toString ? query._id.toString() : query._id;
          const itemId = item._id?.toString ? item._id.toString() : item._id;
          if (queryId !== itemId) return false;
        } else if (query[key] !== undefined) {
          if (item[key] !== query[key]) return false;
        }
      }
      return true;
    });

    return {
      sort: (sortObj) => {
        const sortKeys = Object.keys(sortObj || {});
        if (sortKeys.length > 0) {
          const key = sortKeys[0];
          const direction = sortObj[key];
          results = [...results].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (key === 'createdAt') {
              valA = new Date(valA).getTime();
              valB = new Date(valB).getTime();
            }
            if (valA < valB) return direction === 1 ? -1 : 1;
            if (valA > valB) return direction === 1 ? 1 : -1;
            return 0;
          });
        }
        return {
          limit: (limitNum) => {
            if (limitNum && limitNum > 0) {
              results = results.slice(0, limitNum);
            }
            return {
              toArray: async () => results
            };
          },
          toArray: async () => results
        };
      },
      limit: (limitNum) => {
        if (limitNum && limitNum > 0) {
          results = results.slice(0, limitNum);
        }
        return {
          toArray: async () => results
        };
      },
      toArray: async () => results
    };
  }

  async findOne(query = {}) {
    return this.items.find(item => {
      for (const key of Object.keys(query)) {
        if (key === '_id') {
          const queryId = query._id?.toString ? query._id.toString() : query._id;
          const itemId = item._id?.toString ? item._id.toString() : item._id;
          if (queryId !== itemId) return false;
        } else if (query[key] !== undefined) {
          if (item[key] !== query[key]) return false;
        }
      }
      return true;
    }) || null;
  }

  async insertOne(doc) {
    const newDoc = {
      ...doc,
      _id: doc._id || Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      createdAt: doc.createdAt || new Date()
    };
    this.items.push(newDoc);
    this.saveCallback();
    return { insertedId: newDoc._id, acknowledged: true };
  }

  async updateOne(filter, update) {
    const item = await this.findOne(filter);
    if (!item) return { matchedCount: 0, modifiedCount: 0 };

    if (update.$set) {
      Object.assign(item, update.$set);
    }
    if (update.$inc) {
      for (const [key, incVal] of Object.entries(update.$inc)) {
        item[key] = (Number(item[key]) || 0) + Number(incVal);
      }
    }
    this.saveCallback();
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter) {
    const idx = this.items.findIndex(item => {
      for (const key of Object.keys(filter)) {
        if (key === '_id') {
          const queryId = filter._id?.toString ? filter._id.toString() : filter._id;
          const itemId = item._id?.toString ? item._id.toString() : item._id;
          if (queryId !== itemId) return false;
        } else if (filter[key] !== undefined) {
          if (item[key] !== filter[key]) return false;
        }
      }
      return true;
    });

    if (idx !== -1) {
      this.items.splice(idx, 1);
      this.saveCallback();
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async countDocuments(query = {}) {
    const res = await this.find(query).toArray();
    return res.length;
  }
}

let dbInstance = null;
let mongoClient = null;
let isNativeMongo = false;

// Local fallback storage
const localDataDir = path.join(__dirname, 'data');
const localDataFile = path.join(localDataDir, 'store.json');
let localStore = {
  books: [],
  borrows: [],
  users: []
};

function initLocalStore() {
  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true });
  }
  if (fs.existsSync(localDataFile)) {
    try {
      const content = fs.readFileSync(localDataFile, 'utf8');
      localStore = JSON.parse(content);
    } catch (err) {
      console.warn('Could not parse local store, reinitializing:', err.message);
    }
  }

  if (!localStore.books || localStore.books.length === 0) {
    localStore.books = INITIAL_BOOKS.map((b, i) => ({
      ...b,
      _id: `book_${Date.now()}_${i}`
    }));
    saveLocalStore();
  }
}

function saveLocalStore() {
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    fs.writeFileSync(localDataFile, JSON.stringify(localStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local store:', err.message);
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (uri && uri.startsWith('mongodb')) {
    try {
      console.log('Attempting connection to MongoDB at:', uri.replace(/:([^:@]{3,})@/, ':***@'));
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2500 });
      await client.connect();
      mongoClient = client;
      dbInstance = client.db('booknook');
      isNativeMongo = true;
      console.log('Successfully connected to MongoDB database!');

      // Check and seed initial books if empty
      const booksCol = dbInstance.collection('books');
      const count = await booksCol.countDocuments();
      if (count === 0) {
        console.log('Seeding initial library books into MongoDB collection...');
        await booksCol.insertMany(INITIAL_BOOKS);
        console.log(`Seeded ${INITIAL_BOOKS.length} books into MongoDB.`);
      }
      return;
    } catch (err) {
      console.warn(`MongoDB connection failed (${err.message}). Falling back to robust embedded local data store.`);
    }
  } else {
    console.log('No external MONGODB_URI configured. Using embedded zero-config local data store.');
  }

  // Initialize embedded fallback
  initLocalStore();
  isNativeMongo = false;
  console.log(`Embedded store active with ${localStore.books.length} books ready.`);
}

function getCollection(name) {
  if (isNativeMongo && dbInstance) {
    return dbInstance.collection(name);
  }
  return new LocalCollection(name, localStore, saveLocalStore);
}

function formatId(id) {
  if (!id) return null;
  if (isNativeMongo) {
    try {
      return new ObjectId(id);
    } catch (e) {
      return id;
    }
  }
  return id;
}

module.exports = {
  connectDB,
  getCollection,
  formatId,
  isNativeMongo: () => isNativeMongo
};
