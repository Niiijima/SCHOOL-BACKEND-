const { MongoClient } = require('mongodb');
const dns = require('dns');

// Force Google DNS
dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = "mongodb+srv://qagwu11_db_user:Amateratsu@cluster0.lkdlfx4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const sourceDB = "test";
const targetDB = "school_backend";

const collectionsToCopy = [
  "admins",
  "teachers",
  "subjects",
  "students",
  "grades",
  "termstatuses",
  "users"
];

async function migrate() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log(" Connected successfully");

    const source = client.db(sourceDB);
    const target = client.db(targetDB);

    for (const name of collectionsToCopy) {
      const docs = await source.collection(name).find({}).toArray();

      if (docs.length === 0) {
        console.log(` ${name}: empty - skipped`);
        continue;
      }

      await target.collection(name).deleteMany({});
      await target.collection(name).insertMany(docs);
      console.log(` ${name}: copied ${docs.length} documents`);
    }

    console.log("\n Migration completed!");
  } catch (err) {
    console.error(" Error:", err.message);
  } finally {
    await client.close();
  }
}

migrate();