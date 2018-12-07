export default new Promise(($export) => {
  const platform = ['darwin', 'win32'].includes(process.platform) ? process.platform : 'unsupported'
  return $export(import(`./${platform}`).then(m => m.default))
})
