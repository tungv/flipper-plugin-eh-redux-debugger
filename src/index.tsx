import React, { CSSProperties } from "react";
import { PluginClient, usePlugin, createState, useValue, Layout, DetailSidebar, theme } from "flipper-plugin";
import { SearchableTable, Button, Text, ManagedDataInspector, FlexColumn, Input } from "flipper";
import { Radio, Tabs, Breadcrumb } from "antd";
import { goTo, filterBy, getFirstKey } from "./helpers";

type Id = string;

interface Action {
  type: string;
  payload: any;
}

interface Data {
  readonly id: Id;
  readonly prevId: Id;
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

const plugin = (client: PluginClient<Events, {}>) => {
  const dataState = createState<DataState>(emptyDataState, { persist: "dataState" });
  const selectedId = createState<Id | null>(null, { persist: "selectedId" });

  client.onMessage("actionDispatched", (newData) => {
    newData.displayedStartTime = new Date(newData.startTime).toLocaleTimeString();
    newData.displayedTookTime = `${newData.took} ms`;
    newData.displayedActionType = newData.action.type;

    if (apiCallActions.includes(newData.action.type)) {
      newData.displayedActionType = `${newData.action.type} (${newData.action.payload.name})`;
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
};

const Component = () => {
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
};

const Detail = ({ data }: { data: Data }) => {
  const [activeTab, setActiveTab] = React.useState<string>("action");

  const handleTabChange = (e: any) => {
    setActiveTab(e.target.value);
  };

  return (
    <FlexColumn grow={true} scrollable={false} style={{ position: "absolute" }}>
      <Layout.Container pad="small" center={true}>
        <Radio.Group value={activeTab} onChange={handleTabChange}>
          <Radio.Button value="action">Action</Radio.Button>
          <Radio.Button value="state">State</Radio.Button>
          <Radio.Button value="diff">Diff</Radio.Button>
        </Radio.Group>
      </Layout.Container>

      <div style={{ overflow: "auto" }}>
        <Layout.Container pad="small">
          <Tabs activeKey={activeTab} renderTabBar={Empty}>
            <Tabs.TabPane key="action">
              <ActionTab action={data.action} />
            </Tabs.TabPane>
            <Tabs.TabPane key="state">
              <StateTab state={data.stateAfter} />
            </Tabs.TabPane>
            <Tabs.TabPane key="diff">
              <DiffTab data={data} />
            </Tabs.TabPane>
          </Tabs>
        </Layout.Container>
      </div>
    </FlexColumn>
  );
};

const Empty = () => <></>;

const DiffTab = ({ data }: { data: Data }) => {
  const instance = usePlugin(plugin);
  const dataState = useValue(instance.dataState);

  const stateAfter = data.stateAfter;
  const stateBefore = dataState.byIds[data.prevId] ? dataState.byIds[data.prevId].stateAfter : {};

  return <ManagedDataInspector diff={stateBefore} data={stateAfter} collapsed={true} expandRoot={false} />;
};

const ActionTab = ({ action }: { action: Action }) => {
  return <ManagedDataInspector data={action} collapsed={true} expandRoot={true} />;
};

const StateTab = ({ state }: { state: object }) => {
  const [statePath, setStatePath] = React.useState<Array<string>>([]);
  const [stateKey, setStateKey] = React.useState<string>("");

  const filteredState = filterBy(stateKey)(goTo(statePath)(state));

  const handleChange = (e: any) => {
    setStateKey(e.target.value);
  };

  const handleSearch = (e: any) => {
    e.preventDefault();

    const stateKey = getFirstKey(filteredState);

    if (stateKey) {
      setStateKey("");
      setStatePath(statePath.concat([stateKey]));
    }
  };

  const handleClick = (pathIndex: number) => {
    setStateKey("");
    setStatePath(statePath.slice(0, pathIndex));
  };

  return (
    <>
      <form onSubmit={handleSearch}>
        <Input placeholder="Search state" value={stateKey} onChange={handleChange} style={styles.searchInput} />
      </form>

      <Breadcrumb separator=">" style={styles.breadcrumb}>
        <Breadcrumb.Item href="#" onClick={() => handleClick(0)}>
          root
        </Breadcrumb.Item>
        {statePath.map((path, i) => (
          <Breadcrumb.Item key={i + 1} href="#" onClick={() => handleClick(i + 1)}>
            {path}
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>

      <ManagedDataInspector data={filteredState} collapsed={true} expandRoot={true} />
    </>
  );
};

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

const styles: Record<string, CSSProperties> = {
  searchInput: {
    width: "100%",
    marginBottom: theme.space.small,
  },
  breadcrumb: {
    display: "flex",
    flexWrap: "wrap",
    marginBottom: theme.space.medium,
    fontSize: theme.fontSize.small,
  },
};

export { plugin, Component };
