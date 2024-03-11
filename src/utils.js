export function oneName(name) {
  return name.split(";").sort((a, b) => b.length - a.length)[0]
}

export function transformData(data) {
  let transformed = [];
  let keys = Object.keys(data);
  let length = Object.keys(data[keys[0]]).length

  for (let i = 0; i < length; i++) {
      let row = {};
      keys.forEach(key => {
          row[key] = data[key][i];
      });
      transformed.push(row);
  }

  return transformed;
}

export function zoomToPos(x, y) {
  window.renderer.camera.x = x
  window.renderer.camera.y = y
  window.renderer.refresh()
}