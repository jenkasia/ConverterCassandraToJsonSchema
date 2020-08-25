import cassandra from 'cassandra-driver';
import { config } from './config'
import fs from 'fs';
import { SchemaGenerator } from './jsonSchemaGenerator'

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

//lost with tables from database
let tableList = []

//Return promise that get all pages name in database
const getAllTables = () => {
  const query = `SELECT table_name FROM system_schema.tables WHERE keyspace_name = '${config.databaseName}';`;
  return execute(query, [], (err, result) => { tableList = result.rows.map(table => table.table_name) })
}

//Function that save stringified JSON to file
const saveSchemaToFile = (fileName, dataToSave) => {
  fs.writeFileSync(`schemas/${fileName}.json`, dataToSave, function (err) {
    if (err) {
      throw err
    };
    console.log(`Schema ${fileName} was saved`);
  });
}

//Schema creator
const createSchemaForAllTablesHandler = (tableNames) => {
  const tablesItemsReferences = []

  //Create query to get first line from database
  const queryGenerator = (tableName) => {
    return `SELECT JSON * FROM ${config.databaseName}.${tableName} LIMIT 1;`
  }

  const executors = tableNames.map(tableName => {
    const query = queryGenerator(tableName)
    return execute(query, [], (err, result) => {
      tablesItemsReferences.push({ tableTitle: tableName, resultRow: result.rows[0] })
    })
  })

  //Return promise that generate schema and call saver to file function
  return Promise.all(executors).then(() => {
    tablesItemsReferences.forEach(tableItemRow => {
      if (tableItemRow.resultRow) {
        let objectOfDataRow = JSON.parse(tableItemRow.resultRow[`[json]`], (key, value) => {
          try {
            return JSON.parse(value)
          }
          catch {
            return value
          }
        }
        );
        const title = tableItemRow.tableTitle
        let schema = SchemaGenerator(title, objectOfDataRow)
        let stringifiedSchema = JSON.stringify(schema)
        saveSchemaToFile(title, stringifiedSchema)
      }
      else {
        console.log(`First line in table ${tableItemRow.tableTitle} is undefined `)
      }
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

