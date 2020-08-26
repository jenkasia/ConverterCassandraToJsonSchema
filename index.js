import cassandra from 'cassandra-driver';
import { config } from './config'
import fs from 'fs';
import SchemaGenerator from './cqlToJsonSchema'
import util from 'util'

const client = new cassandra.Client({
  contactPoints: [config.host],
  protocolOptions: { port: config.port },
  localDataCenter: config.localDataCenter,
  credentials: { username: config.user, password: config.password },
  keyspace: config.databaseName,
});
client.connect();

//generator executor function
function execute(query, params, callback) {
  return new Promise((resolve, reject) => {
    client.execute(query, params, (err, result) => {
      if (err) {
        reject()
      } else {
        callback(err, result);
        resolve()
      }
    });
  });
}

//list with tables from database
let tableList = []

//Return promise that get all pages name in database
const getAllTables = () => {
  const query = `SELECT table_name FROM system_schema.tables WHERE keyspace_name = '${config.databaseName}';`;
  return execute(query, [], (err, result) => { tableList = result.rows.map(table => table.table_name) })
}

//Function that save stringified JSON to file
const saveSchemaToFile = (schemaToSave) => {
  const stringifiedSchema = JSON.stringify(schemaToSave)
  fs.writeFileSync(`schemas/${schemaToSave.title}.json`, stringifiedSchema, function (err) {
    if (err) {
      throw err
    };
    console.log(`Schema ${fileName} was saved`);
  });
}

//Schema creator
const createSchemaForAllTablesHandler = (tableNames) => {

  const executors = tableNames.map(tableName => {
    const tableReference = client.metadata.getTable(config.databaseName, tableName)
    return tableReference
  })

  //Can Get UDT
  return Promise.all(executors).then((tablesItemsReferences) => {
    tablesItemsReferences.forEach(tablesItemsReference => {
      const resultSchema = SchemaGenerator(tablesItemsReference)
      saveSchemaToFile(resultSchema)
    })
  });
}

//main function generator
const generateJsonSchema = async () => {
  await getAllTables()
  await createSchemaForAllTablesHandler(tableList)
  console.log('Script was successfully finished');
  process.exit();
}

generateJsonSchema()

