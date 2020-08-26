import cassandra from 'cassandra-driver';

const getJsonSchemaType = (cassandraType) => {
  switch (cassandraType) {
    case 'inet':
    case 'time':
    case 'text':
    case 'blob':
    case 'date':
    case 'uuid':
    case 'ascii':
    case 'varchar':
    case 'duration':
    case 'timeuuid':
    case 'timestamp':
      return 'string';
    case 'int':
    case 'bigint':
    case 'varint':
    case 'tinyint':
    case 'counter':
    case 'smallint':
      return 'integer'
    case 'float':
    case 'double':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean'
    case 'map':
    case 'udt':
      return 'object'
    case 'list':
    case 'set':
    case 'tuple':
      return 'array'
    default:
      return 'string'
  }
}

const getCassandraType = (fullCassandraTypeString,) => {
  const indexOfOpenBracket = fullCassandraTypeString.indexOf('<')
  if (indexOfOpenBracket === -1) {
    return fullCassandraTypeString
  }
  const cassandraType = fullCassandraTypeString.substring(0, indexOfOpenBracket)
  return cassandraType
}

const getPropertiesForObject = (fieldDescription, jsonTypeName) => {
  let properties = {}
  fieldDescription.info.forEach((item, index) => {
    if (index === 0) {
      properties = {
        ...properties,
        itemKey: generateSchemaForField(item)
      }
    }
    else {
      properties = {
        ...properties,
        itemValue: generateSchemaForField(item)
      }
    }
  })
  return { type: jsonTypeName, properties }
}

const getPropertiesForUDT = (fieldDescription, jsonTypeName) => {
  let properties = {}
  fieldDescription.info.fields.forEach(item => {
    properties = {
      ...properties,
      [item.name]: generateSchemaForField(item.type)
    }
  })
  return { type: jsonTypeName, properties }

}

const getPropertiesForArray = (fieldDescription, jsonTypeName, cassandraTypeName) => {
  let items = []
  let required = []

  if (Array.isArray(fieldDescription.info)) {
    fieldDescription.info.forEach(item => {
      items = [
        ...items,
        generateSchemaForField(item)
      ]
    })
    if (cassandraTypeName === 'tuple') {
      fieldDescription.info.forEach((item, index) => {
        required = [...required, String(index)]
      })
    }
  }
  else {
    items = [
      ...items,
      generateSchemaForField(fieldDescription.info)
    ]
  }
  if (required.length > 0) {
    return { type: jsonTypeName, items, required }
  }
  return { type: jsonTypeName, items }
}

const generateSchemaForField = (fieldDescription) => {
  const typeName = cassandra.types.getDataTypeNameByCode(fieldDescription)
  const cassandraTypeName = getCassandraType(typeName)
  const jsonTypeName = getJsonSchemaType(cassandraTypeName)

  if (jsonTypeName === 'object' && cassandraTypeName !== 'udt') {
    return getPropertiesForObject(fieldDescription, jsonTypeName)
  }

  else if (jsonTypeName === 'object' && cassandraTypeName === 'udt') {
    return getPropertiesForUDT(fieldDescription, jsonTypeName)
  }

  else if (jsonTypeName === 'array') {
    return getPropertiesForArray(fieldDescription, jsonTypeName, cassandraTypeName)
  }

  else {
    return { type: jsonTypeName }
  }
}

const cqlToJsonSchemaConverter = (descObjOfColumns) => {

  const $SCHEMA = 'http://json-schema.org/draft-04/schema#'

  let properties = {}

  descObjOfColumns.columns.forEach(columnDescription => {
    properties = {
      ...properties,
      [columnDescription.name]: generateSchemaForField(columnDescription.type)
    }
  })

  let schema = {
    $schema: $SCHEMA,
    type: typeof (descObjOfColumns),
    title: descObjOfColumns.name,
    properties: properties
  }
  return schema
}

export default cqlToJsonSchemaConverter 