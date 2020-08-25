const getType = (value) => {
  let isArray = Array.isArray(value)
  if (isArray) {
    return 'array'
  }
  return typeof value
}

const arrayHandler = (inputArray, resultObject, isNested) => {

  let isArrayHasManyTypes
  let type

  if (isNested && resultObject) {
    resultObject = { items: resultObject }
  } else {
    resultObject = resultObject || {}
    resultObject.type = getType(inputArray)
    resultObject.items = resultObject.items || {}
    type = resultObject.items.type || null
  }

  for (let arrIndex = 0, arrLength = inputArray.length; arrIndex < arrLength; arrIndex++) {
    let elementType = getType(inputArray[arrIndex])

    if (type && elementType !== type) {
      resultObject.items.oneOf = []
      isArrayHasManyTypes = true
      break
    } else {
      type = elementType
    }
  }

  if (!isArrayHasManyTypes && type) {
    resultObject.items.type = type
  } else if (isArrayHasManyTypes && type !== 'object') {
    resultObject.items = {
      oneOf: [{ type: type }],
      required: resultObject.items.required
    }
  }

  if (typeof resultObject.items.oneOf !== 'undefined' || type === 'object') {
    for (let itemIndex = 0, itemLength = inputArray.length; itemIndex < itemLength; itemIndex++) {
      let value = inputArray[itemIndex]
      let itemType = getType(value)
      let arrayItem
      if (itemType === 'object') {
        arrayItem = objectHandler(value, isArrayHasManyTypes ? {} : resultObject.items.properties, true)
      } else if (itemType === 'array') {
        arrayItem = arrayHandler(value, isArrayHasManyTypes ? {} : resultObject.items.properties, true)
      } else {
        arrayItem = {}
        arrayItem.type = itemType

      }
      if (isArrayHasManyTypes) {
        let childType = getType(value)
        let tempObj = {}
        if (!arrayItem.type && childType === 'object') {
          tempObj.properties = arrayItem
          tempObj.type = 'object'
          arrayItem = tempObj
        }
        resultObject.items.oneOf.push(arrayItem)
      } else {
        if (resultObject.items.type !== 'object') {
          continue;
        }
        resultObject.items.properties = arrayItem
      }
    }
  }
  return isNested ? resultObject.items : resultObject
}


const objectHandler = (object, resultObject, isNested) => {
  if (isNested && resultObject) {
    resultObject = { properties: resultObject }
  } else {
    resultObject = resultObject || {}
    resultObject.type = getType(object)
    resultObject.properties = resultObject.properties || {}
  }

  for (let key in object) {
    let value = object[key]
    let valueType = getType(value)
    valueType = valueType === 'undefined' ? 'null' : valueType

    if (valueType === 'object') {
      resultObject.properties[key] = objectHandler(value, resultObject.properties[key])
      continue
    }

    if (valueType === 'array') {
      resultObject.properties[key] = arrayHandler(value, resultObject.properties[key])
      continue
    }

    resultObject.properties[key] = {}
    resultObject.properties[key].type = valueType

  }
  return isNested ? resultObject.properties : resultObject
}

export function SchemaGenerator(title, object) {
  const $SCHEMA = 'http://json-schema.org/draft-04/schema#'
  let processOutput
  const jsonSchema = {
    $schema: $SCHEMA,
    title: title,
    type: getType(object)
  }

  switch (jsonSchema.type) {

    case 'object':
      processOutput = objectHandler(object)
      jsonSchema.type = processOutput.type
      jsonSchema.properties = processOutput.properties
      break;

    case 'array':
      processOutput = arrayHandler(object)
      jsonSchema.type = processOutput.type
      jsonSchema.items = processOutput.items
      jsonSchema.items.title = jsonSchema.title
      jsonSchema.title += ' Set'
      break;

    default:
      break;
  }

  return jsonSchema
}
