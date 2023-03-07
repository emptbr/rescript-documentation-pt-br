/*
 * This script is used for generating the table of contents for prose
 * text documents
 */
import unified from "unified";
import markdown from "remark-parse";
import matter from "gray-matter";
import stringify from "remark-stringify";
import slug from "remark-slug";
import glob from "glob";
import path from "path";
import fs from "fs";
import { URL } from "url";

const pathname = new URL(".", import.meta.url).pathname;
const __dirname =
  process.platform !== "win32" ? pathname : pathname.substring(1);

// orderArr: ["introduction", "overview",,...]
const orderFiles = (filepaths, orderArr) => {
  const order = orderArr.reduce((acc, next, i) => {
    acc[next] = null;
    return acc;
  }, {});

  filepaths.forEach((filepath) => {
    const id = path.basename(filepath, path.extname(filepath));
    order[id] = filepath;
  });

  console.log({ filepaths });

  // last sanity check if there's an unmatched filepath
  Object.entries(order).forEach(([name, filepath]) => {
    // may happen e.g. due to invalid file paths within
    // sidebar json
    if (filepath == null) {
      throw new Error(
        `Cannot find file for "${name}". Does it exist in the pages folder?`
      );
    }
  });

  return Object.values(order);
};

// Used for collapsing nested inlineCodes with the actual header text
const collapseHeaderChildren = (children) => {
  return children.reduce((acc, node) => {
    if (node.type === "link") {
      return acc + collapseHeaderChildren(node.children);
    }
    // Prevents 'undefined' values in our headers
    else if (node.value == null) {
      return acc;
    }
    return acc + node.value;
  }, "");
};

const headers = (options) => (tree, file) => {
  const headers = [];
  let mainHeader;
  tree.children.forEach((child) => {
    if (child.type === "heading" && child.depth === 1) {
      if (child.children.length > 0) {
        mainHeader = collapseHeaderChildren(child.children);
      }
    }
    if (child.type === "heading" && child.depth === 2) {
      if (child.children.length > 0) {
        // Take the id generated from remark-slug
        const headerValue = collapseHeaderChildren(child.children);
        const id = child.data.id || "";
        headers.push({ name: headerValue, href: id });
      }
    }
  });

  file.data = Object.assign({}, file.data, { headers, mainHeader });
};

const processor = unified()
  .use(markdown, { gfm: true })
  .use(slug)
  .use(stringify)
  .use(headers);

// sidebarJson: { [category: string]: array<plain_filename_without_ext> }
const processFile = (filepath, sidebarJson = {}) => {
  const raw = fs.readFileSync(filepath, "utf8");
  const { content, data } = matter(raw);
  const result = processor.processSync(content);

  const pagesPath = path.resolve("./pages");
  const relFilepath = path.relative(pagesPath, filepath);
  const parsedPath = path.parse(relFilepath);
  const filename = path.basename(filepath, path.extname(filepath));

  const title = data.title || result.data.mainHeader || filename;

  let category;
  for (const [categoryName, items] of Object.entries(sidebarJson)) {
    if (items.find((item) => filename === item)) {
      category = categoryName;
      break;
    }
  }

  const dataset = {
    id: filename,
    headers: result.data.headers,
    href: path.join(parsedPath.dir, parsedPath.name),
    title,
  };

  if (category != null) {
    dataset.category = category;
  }
  return dataset;
};

const createTOC = (result) => {
  // Currently we reorder the data to a map, the key is
  // reflected as the router pathname, as defined by the
  // NextJS router
  return result.reduce((acc, data) => {
    const { title, headers, category, id } = data;
    acc["/" + data.href] = {
      id,
      title,
      headers,
      category,
    };

    return acc;
  }, {});
};

const createLatestManualToc = (lang) => {
  let MD_DIR = path.join(__dirname, "../pages/docs/manual/latest");
  let SIDEBAR_JSON = path.join(
    __dirname,
    "../data/sidebar_manual_latest.json"
  );
  let TARGET_FILE = path.join(
    __dirname,
    "../index_data/manual_latest_toc.json"
  );

  if (lang) {
    MD_DIR = path.join(__dirname, `../pages/${lang}/docs/manual/latest`);
    SIDEBAR_JSON = path.join(
      __dirname,
      `../data/${lang}/sidebar_manual_latest.json`
    );
    TARGET_FILE = path.join(
      __dirname,
      `../index_data/${lang}/manual_latest_toc.json`
    );
  }

  const sidebarJson = JSON.parse(fs.readFileSync(SIDEBAR_JSON));

  const FILE_ORDER = Object.values(sidebarJson).reduce((acc, items) => {
    return acc.concat(items);
  }, []);

  const files = glob.sync(`${MD_DIR}/*.?(js|md?(x))`);
  const ordered = orderFiles(files, FILE_ORDER);

  const result = ordered.map((filepath) => processFile(filepath, sidebarJson));
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

const createReasonCompilerToc = (lang) => {
  let MD_DIR = path.join(__dirname, "../pages/docs/reason-compiler/latest");
  let TARGET_FILE = path.join(
    __dirname,
    "../index_data/reason_compiler_toc.json"
  );

  if (lang) {
    MD_DIR = path.join(
      __dirname,
      `../pages/${lang}/docs/reason-compiler/latest`
    );
    TARGET_FILE = path.join(
      __dirname,
      `../index_data/${lang}/reason_compiler_toc.json`
    );
  }


  const files = glob.sync(`${MD_DIR}/*.md?(x)`);
  const result = files.map(processFile);
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

const createV900ManualToc = (lang) => {
  let MD_DIR = path.join(__dirname, "../pages/docs/manual/v9.0.0");
  let SIDEBAR_JSON = path.join(__dirname, "../data/sidebar_manual_v900.json");
  let TARGET_FILE = path.join(
    __dirname,
    "../index_data/manual_v900_toc.json"
  );

  if (lang) {
    MD_DIR = path.join(__dirname, `../pages/${lang}/docs/manual/v9.0.0`);
    SIDEBAR_JSON = path.join(__dirname, `../data/${lang}/sidebar_manual_v900.json`);
    TARGET_FILE = path.join(
      __dirname,
      `../index_data/${lang}/manual_v900_toc.json`
    );
  }

  const sidebarJson = JSON.parse(fs.readFileSync(SIDEBAR_JSON));

  const FILE_ORDER = Object.values(sidebarJson).reduce((acc, items) => {
    return acc.concat(items);
  }, []);

  const files = glob.sync(`${MD_DIR}/*.?(js|md?(x))`);
  const ordered = orderFiles(files, FILE_ORDER);

  const result = ordered.map((filepath) => processFile(filepath, sidebarJson));
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

const createV800ManualToc = (lang) => {
  let MD_DIR = path.join(__dirname, "../pages/docs/manual/v8.0.0");
  let SIDEBAR_JSON = path.join(__dirname, "../data/sidebar_manual_v800.json");
  let TARGET_FILE = path.join(
    __dirname,
    "../index_data/manual_v800_toc.json"
  );

  if (lang) {
    MD_DIR = path.join(__dirname, `../pages/${lang}/docs/manual/v8.0.0`);
    SIDEBAR_JSON = path.join(__dirname, `../data/${lang}/sidebar_manual_v800.json`);
    TARGET_FILE = path.join(
      __dirname,
      `../index_data/${lang}/manual_v800_toc.json`
    );
  }

  const sidebarJson = JSON.parse(fs.readFileSync(SIDEBAR_JSON));

  const FILE_ORDER = Object.values(sidebarJson).reduce((acc, items) => {
    return acc.concat(items);
  }, []);

  const files = glob.sync(`${MD_DIR}/*.?(js|md?(x))`);
  const ordered = orderFiles(files, FILE_ORDER);

  const result = ordered.map((filepath) => processFile(filepath, sidebarJson));
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

const createReactToc = (version, lang) => {
  const versionLabel = version.replace(/\./g, "");
  let MD_DIR = path.join(__dirname, "../pages/docs/react");
  let SIDEBAR_JSON = path.join(
    __dirname,
    `../data/sidebar_react_${versionLabel}.json`
  );
  let TARGET_FILE = path.join(
    __dirname,
    `../index_data/react_${versionLabel}_toc.json`
  );

  if (lang) {
    MD_DIR = path.join(__dirname, `../pages/${lang}/docs/react`);
    SIDEBAR_JSON = path.join(
      __dirname,
      `../data/${lang}/sidebar_react_${versionLabel}.json`
    );
    TARGET_FILE = path.join(
      __dirname,
      `../index_data/${lang}/react_${versionLabel}_toc.json`
    );
  }

  const sidebarJson = JSON.parse(fs.readFileSync(SIDEBAR_JSON));

  const FILE_ORDER = Object.values(sidebarJson).reduce((acc, items) => {
    return acc.concat(items);
  }, []);

  const files = glob.sync(`${MD_DIR}/${version}/*.md?(x)`);
  const ordered = orderFiles(files, FILE_ORDER);

  const result = ordered.map((filepath) => processFile(filepath, sidebarJson));
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

const createGenTypeToc = (lang) => {
  let MD_DIR = path.join(__dirname, "../pages/docs/gentype/latest");
  let SIDEBAR_JSON = path.join(
    __dirname,
    "../data/sidebar_gentype_latest.json"
  );
  let TARGET_FILE = path.join(
    __dirname,
    "../index_data/gentype_latest_toc.json"
  );

  if (lang) {
    MD_DIR = path.join(__dirname, `../pages/${lang}/docs/gentype/latest`);
    SIDEBAR_JSON = path.join(
      __dirname,
      `../data/${lang}/sidebar_gentype_latest.json`
    );
    TARGET_FILE = path.join(
      __dirname,
      `../index_data/${lang}/gentype_latest_toc.json`
    );
  }

  const sidebarJson = JSON.parse(fs.readFileSync(SIDEBAR_JSON));

  const FILE_ORDER = Object.values(sidebarJson).reduce((acc, items) => {
    return acc.concat(items);
  }, []);

  const files = glob.sync(`${MD_DIR}/*.?(js|md?(x))`);
  // console.log({ files, sidebarJson, MD_DIR, lang });
  const ordered = orderFiles(files, FILE_ORDER);

  const result = ordered.map((filepath) => processFile(filepath, sidebarJson));
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

const createCommunityToc = (lang) => {
  let MD_DIR = path.join(__dirname, "../pages/community");
  let SIDEBAR_JSON = path.join(__dirname, "../data/sidebar_community.json");
  let TARGET_FILE = path.join(__dirname, "../index_data/community_toc.json");

  if (lang) {
    MD_DIR = path.join(__dirname, `../pages/${lang}/community`);
    SIDEBAR_JSON = path.join(__dirname, `../data/${lang}/sidebar_community.json`);
    TARGET_FILE = path.join(__dirname, `../index_data/${lang}/community_toc.json`);
  }

  const sidebarJson = JSON.parse(fs.readFileSync(SIDEBAR_JSON));

  const FILE_ORDER = Object.values(sidebarJson).reduce((acc, items) => {
    return acc.concat(items);
  }, []);

  const files = glob.sync(`${MD_DIR}/*.?(js|md?(x))`);
  const ordered = orderFiles(files, FILE_ORDER);

  const result = ordered.map((filepath) => processFile(filepath, sidebarJson));
  const toc = createTOC(result);

  fs.writeFileSync(TARGET_FILE, JSON.stringify(toc), "utf8");
};

/*
const debugToc = () => {
  const MD_DIR = path.join(__dirname, "../pages/docs/manual/latest");

  const files = glob.sync(`${MD_DIR}/introduction.md?(x)`);
  const result = files.map(processFile);
  const toc = createTOC(result);

  console.log(JSON.stringify(toc, null, 2));

};

debugToc();
*/

// main

function Run(lang) {
  createLatestManualToc(lang);
  createV900ManualToc(lang);
  createV800ManualToc(lang);
  createReasonCompilerToc(lang);
  createReactToc("latest", lang);
  createReactToc("v0.10.0", lang);
  createGenTypeToc(lang);
  createCommunityToc(lang);
}

function GenerateDocs() {
  console.log('GERANDO DOCS')
  const languages = ["en", "pt-BR"];

  for (let language of languages) {
    console.log('DOC EM: ', language)
    if (language === "en") {
      Run();
      console.log(`DOC EM: ${language}`, 'DONE')
    } else {
      Run(language);
      console.log(`DOC EM: ${language}`, 'DONE')
    }
  }
}

GenerateDocs();
