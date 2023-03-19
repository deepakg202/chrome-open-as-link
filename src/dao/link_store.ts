import LocalForage from "localforage";
import { Link } from "../models/link";
import { v4 as uuidv4 } from "uuid";

const LINK_STORE_NAME = "linkStore";
export const CHROME_STORAGE_LINKS_KEY: string = "syncedLinks";

export class LinkStore {
  storeInstance: LocalForage;

  private static instance: LinkStore;

  listeners: Array<VoidFunction> = [];

  addListener(cb: VoidFunction): void {
    this.listeners.push(cb);
  }

  removeListener(cb: VoidFunction): void {
    this.listeners = this.listeners.filter((fn) => fn !== cb);
  }

  notifyListeners() {
    this.listeners.forEach((cb) => cb());
  }

  public static getInstance(): LinkStore {
    if (!LinkStore.instance) {
      LinkStore.instance = new LinkStore();
    }
    return LinkStore.instance;
  }

  async syncLinks(): Promise<void> {
    const val = await chrome.storage.sync.get(CHROME_STORAGE_LINKS_KEY);
    const linksStr = val[CHROME_STORAGE_LINKS_KEY];
    if (!linksStr || typeof linksStr !== "string") return;
    const parsed = JSON.parse(linksStr);
    if (parsed instanceof Array) return;
    parsed.forEach((link: any) => {
      if (!(link.id && link.name && link.url)) return;
      this.storeInstance.setItem(link.id, link.jsonString());
    });
  }

  constructor() {
    this.storeInstance = LocalForage.createInstance({
      name: LINK_STORE_NAME,
      version: 1,
      storeName: LINK_STORE_NAME,
    });
    this.prepare().then();
  }

  async prepare(): Promise<boolean> {
    try {
      await this.storeInstance.ready();
      await this.syncLinks();
      return true;
    } catch (er) {
      return false;
    }
  }

  async getAllLinks(): Promise<Array<Link>> {
    const links: Array<Link> = [];
    await this.storeInstance.iterate<string, void>((value, key, _) => {
      const link = Link.fromJsonString(value);
      links.push(link);
    });
    return links;
  }

  async getAllLinksAsJson(): Promise<Array<Record<string, any>>> {
    const links = await this.getAllLinks();
    return links.map((link) => link.toJson());
  }

  async getLinkById(id: string): Promise<Link | undefined | null> {
    const linkStr = await this.storeInstance.getItem(id);
    if (!linkStr || typeof linkStr !== "string") return;
    return Link.fromJsonString(linkStr);
  }

  async addLink(name: string, url: string): Promise<string> {
    const uniqueId = uuidv4();
    const linkObj = new Link(uniqueId, url, name);
    const val = await this.storeInstance.setItem(
      uniqueId,
      linkObj.jsonString()
    );
    this.notifyListeners();
    return val;
  }

  async editLink(id: string, url: string, name: string): Promise<string> {
    const link = new Link(id, url, name);
    const val = await this.storeInstance.setItem(id, link.jsonString());
    this.notifyListeners();
    return val;
  }

  async removeLink(id: string): Promise<void> {
    await this.storeInstance.removeItem(id);
    this.notifyListeners();
  }
}
