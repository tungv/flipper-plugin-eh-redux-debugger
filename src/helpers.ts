/// <reference path="lib.d.ts"/>
import brn from "brn";
import { flow, always, isEmpty, identity, pickBy, sortBy, keys, get } from "lodash/fp";

export const insensitiveIncludes = (searchStr: string, str: string): boolean => new RegExp(searchStr, "i").test(str);

export const goTo = (path: Array<string>) => brn(always(isEmpty(path)), identity, get(path));

export const filterBy = (key: string) =>
  brn(
    always(isEmpty(key)),
    identity,
    pickBy((_, k) => insensitiveIncludes(key, k))
  );

export const getFirstKey = flow(keys, sortBy(identity), get(0));
