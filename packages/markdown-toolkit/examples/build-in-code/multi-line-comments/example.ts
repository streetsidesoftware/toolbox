import * as md from '@streetsidesoftware/markdown-toolkit';

const page = md.document(
  md.comment('cspell:ignore ssjcs\ncspell:words StreetSideSoftware'),
  md.p('Maintained by Street Side Software.'),
);

console.log(page.toString());
