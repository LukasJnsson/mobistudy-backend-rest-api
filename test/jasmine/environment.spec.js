import { getWeather, getPollution, getLocation, getAllergenes } from '../../src/services/environment.mjs'

// Warning: for this test to work, a proper configuration file with API keys must be given!

// tests deactivated to avoid spamming public APIs
// REMOVE THE x TO ACTIVATE THE TESTS
xdescribe('when searching for environment', () => {

  it('you can retrieve weather', async () => {
    let weather = await getWeather(55.6028859, 13.019894299999999)
    expect(weather).not.toBeUndefined()
    expect(weather.location === 'Malmo' || weather.location === 'Gamla Staden').toBeTruthy()
  })

  it('you can retrieve pollution', async () => {
    let aq = await getPollution(55.6028859, 13.019894299999999)
    expect(aq).not.toBeUndefined()
    expect(aq.aqi).not.toBeUndefined()
  })

  it('you can retrieve postcode', async () => {
    let pc = await getLocation(51.751985, -1.257609)
    expect(pc).not.toBeUndefined()
    expect(pc.postcode).toBe('OX1 4DS')
  })

  it('you sometimes cannot retrieve postcode', async () => {
    let pc = await getLocation(55.6028859, 13.019894299999999)
    expect(pc).toBeUndefined()
  })

  it('you can retrieve pollen', async () => {
    let pol = await getAllergenes(55.6028859, 13.019894299999999)
    expect(pol).not.toBeUndefined()
  })
})
