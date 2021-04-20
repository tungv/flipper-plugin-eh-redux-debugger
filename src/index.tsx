import React from "react";
import { PluginClient, usePlugin, createState, useValue, Layout, DetailSidebar } from "flipper-plugin";
import { SearchableTable, Button, Text, ManagedDataInspector, FlexColumn } from "flipper";
import { Radio, Tabs } from "antd";

type Id = string;

interface Action {
  type: string;
  payload: any;
}

interface Data {
  readonly id: Id;
  readonly action: Action;
  readonly stateAfter: object;
  readonly startTime: number;
  readonly took: number;
  displayedStartTime?: string;
  displayedActionType?: string;
  displayedTookTime?: string;
}

interface DataState {
  byIds: Record<Id, Data>;
  allIds: Array<Id>;
}

type Events = {
  actionDispatched: Data;
};

const emptyDataState = {
  byIds: {},
  allIds: [],
};

const apiCallActions = [
  "@@api/FETCH_START",
  "@@api/FETCH_COMPLETE",
  "@@api/FETCH_FAILURE",
  "@@api/UPDATE_LOCAL",
  "@@api/RESET_LOCAL",
  "@@api/DISPOSE",
];

export function plugin(client: PluginClient<Events, {}>) {
  const dataState = createState<DataState>(emptyDataState, { persist: "dataState" });
  const selectedId = createState<Id | null>(null, { persist: "selectedId" });

  client.onMessage("actionDispatched", (newData) => {
    newData.displayedStartTime = new Date(newData.startTime).toLocaleTimeString();
    newData.displayedTookTime = `${newData.took} ms`;

    if (apiCallActions.includes(newData.action.type)) {
      newData.displayedActionType = `${newData.action.type} (${newData.action.payload.name})`;
    } else {
      newData.displayedActionType = newData.action.type;
    }

    dataState.update((draft) => {
      draft.byIds[newData.id] = newData;
      draft.allIds.push(newData.id);
    });
  });

  function clear() {
    selectedId.set(null);
    dataState.set(emptyDataState);
  }

  function setSelectedId(id: Id) {
    selectedId.set(id);
  }

  return { dataState, selectedId, clear, setSelectedId };
}

const columns = {
  startTime: {
    value: "Time",
  },
  actionType: {
    value: "Action",
  },
  took: {
    value: "Took",
  },
};

const columnSizes = {
  startTime: "15%",
  actionType: "70%",
  took: "15%",
};

export function Component() {
  const instance = usePlugin(plugin);
  const dataState = useValue(instance.dataState);
  const selectedId = useValue(instance.selectedId);

  const rows = dataState.allIds.map((id) => {
    const data = dataState.byIds[id];

    return {
      key: id,
      columns: {
        startTime: {
          value: <Text>{data.displayedStartTime}</Text>,
        },
        actionType: {
          value: <Text>{data.displayedActionType}</Text>,
          filterValue: data.displayedActionType,
        },
        took: {
          value: <Text>{data.displayedTookTime}</Text>,
        },
      },
    };
  });

  return (
    <>
      <Layout.ScrollContainer>
        <SearchableTable
          columns={columns}
          columnSizes={columnSizes}
          rowLineHeight={28}
          floating={false}
          multiline={true}
          multiHighlight={false}
          stickyBottom={true}
          rows={rows}
          onRowHighlighted={instance.setSelectedId}
          actions={<Button onClick={instance.clear}>Clear</Button>}
        />
      </Layout.ScrollContainer>
      <DetailSidebar width={420}>{selectedId && <Detail data={dataState.byIds[selectedId]} />}</DetailSidebar>
    </>
  );
}

function Detail({ data }: { data: Data }) {
  const [activeTab, setActiveTab] = React.useState<string>("action");

  return (
    <FlexColumn grow={true} scrollable={false} style={{ position: "absolute" }}>
      <Layout.Container pad="small" center={true}>
        <Radio.Group onChange={(e) => setActiveTab(e.target.value)} value={activeTab}>
          <Radio.Button value="action">Action</Radio.Button>
          <Radio.Button value="state">State</Radio.Button>
          <Radio.Button value="diff">Diff</Radio.Button>
        </Radio.Group>
      </Layout.Container>

      <div style={{ overflow: "auto" }}>
        <Layout.Container pad="small" borderTop>
          <Tabs activeKey={activeTab} renderTabBar={() => <></>}>
            <Tabs.TabPane key="action">
              <ManagedDataInspector data={data.action} collapsed={true} expandRoot={true} />
            </Tabs.TabPane>
            <Tabs.TabPane key="state">
              <ManagedDataInspector data={data.stateAfter} collapsed={true} expandRoot={true} />
            </Tabs.TabPane>
            <Tabs.TabPane key="diff">Coming soon!</Tabs.TabPane>
          </Tabs>
        </Layout.Container>
      </div>
    </FlexColumn>
  );
}
