/**
 * AssetStore 模块架构图(三级降级与数据布局)
 */

export const assetStoreFallbackFlow = `flowchart TD
  Start([createAssetStore options]) --> O1{preferOpfs && isOpfsAvailable?}

  O1 -->|是| O2[createOpfsAssetStore]
  O2 --> O3{初始化成功?}
  O3 -->|是| O4[返回 OPFS Store path: opfs://]
  O3 -->|否| O5

  O1 -->|否| O5{allowIdbFallback && indexedDB 存在?}
  O5 -->|是| O6[createIdbAssetStore Dexie 双表]
  O6 --> O7{初始化成功?}
  O7 -->|是| O8[返回 IDB Store path: idb://]
  O7 -->|否| O9

  O5 -->|否| O9[createMemoryAssetStore 最终降级]
  O9 --> O10[返回内存 Store path: memory://]

  O4 --> End([AssetStore 实例])
  O8 --> End
  O10 --> End`;

export const assetStoreLayout = `flowchart LR
  subgraph OPFS["opfs:// (L1 最优)"]
    direction TB
    OP1["navigator.storage.getDirectory()"]
    OP2["lokvis-assets/ 目录"]
    OP3["<id> 文件 (Blob 原始字节)"]
    OP4["内存 Map 缓存 Asset 元数据"]
    OP1 --> OP2 --> OP3
    OP3 -.-> OP4
  end

  subgraph IDB["idb:// (L2 持久化降级)"]
    direction TB
    ID1["Dexie: lokvis-asset-store"]
    ID2["assets 表 (Asset 元数据, 主键 id)"]
    ID3["blobs 表 (ArrayBuffer, 主键 id)"]
    ID1 --> ID2
    ID1 --> ID3
    ID2 <-.->|事务一致性| ID3
  end

  subgraph MEM["memory:// (L3 最终降级)"]
    direction TB
    ME1["Map<AssetId, Asset>"]
    ME2["Map<AssetId, Blob>"]
    ME1 -.-> ME2
  end

  RT[AssetStore 接口 import / get / getBlob / remove / list / create] --> OPFS
  RT --> IDB
  RT --> MEM`;
