declare interface Window {
    mozIndexedDB?: IDBFactory;
    webkitIndexedDB?: IDBFactory;
    msIndexedDB?: IDBFactory;
    shimIndexedDB?: IDBFactory;
    indexedDB: IDBFactory;
}
