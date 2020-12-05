import { loadAllData, DataCollection } from './DataHandling';

test('data loads without alerts', async () => {
    jest.setTimeout(30000);
    setupFetchMock();
    const data = await loadAllData();
    expect(data.stateInfos.codeToStateName.size).toBe(51);
    //TODO more
});

function setupFetchMock() {
   /*let fetchMock = {
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    onreadystatechange: jest.fn(),
    send: jest.fn().mockImplementation(function() { this.onload(); }),
    readyState: 4,
    responseText: ",",
    status: 200
  }*/

  // @ts-ignore
  window.fetch = (info, init) => {
      const url = info;
      console.log(url); // data/us-state-names.tsv
      //TODO
      return Promise.resolve(url);
  }
}