import React, { useState, useEffect } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Typography,
} from "antd";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import Navbar from "./Navbar";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";

const { Title } = Typography;
const { Option } = Select;

// Constants from PoolBillingSystem.js
const LOCATIONS = {
  OLD_HOUSE: "Old House Of Pool",
  NEW_HOUSE: "New House Of Pool",
};

const OLD_HOUSE_CONFIG = {
  tables: Array.from({ length: 14 }, (_, i) => `Table ${i + 1}`),
  ps: Array.from({ length: 6 }, (_, i) => `Controller ${i + 1}`),
  tt: ["Table Tennis 1", "Table Tennis 2"],
};

const NEW_HOUSE_CONFIG = {
  tables: Array.from({ length: 5 }, (_, i) => `Table ${i + 1}`),
  ps: [],
  tt: [],
};

const Queue = ({
  selectedLocation,
  setSelectedLocation,
  activeTables,
  setActiveTables,
}) => {
  const [queueData, setQueueData] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAppointModal, setShowAppointModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form] = Form.useForm();
  const [appointForm] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState(
    moment().format("YYYY-MM-DD")
  );

  const GAME_TYPES = [
    "Small Table",
    "Medium Table",
    "Large Table",
    "Table Tennis",
    "PS5",
  ];

  // Define all appointment options based on location
  const getAllAppointmentOptions = () => {
    if (selectedLocation === LOCATIONS.OLD_HOUSE) {
      return [
        ...OLD_HOUSE_CONFIG.tables,
        ...OLD_HOUSE_CONFIG.ps,
        ...OLD_HOUSE_CONFIG.tt,
      ];
    } else if (selectedLocation === LOCATIONS.NEW_HOUSE) {
      return [...NEW_HOUSE_CONFIG.tables];
    }
    return [];
  };

  // Filter available options based on activeTables and location
  const getAvailableOptions = () => {
    const allOptions = getAllAppointmentOptions();
    const activeTableNames = activeTables
      .filter((table) => !table.isClosed && table.location === selectedLocation)
      .map((table) => table.table);

    return allOptions.filter((option) => !activeTableNames.includes(option));
  };

  const saveQueue = async (queue) => {
    const queueDocId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseQueue"
        : "newHouseQueue";
    await setDoc(doc(db, "queue", queueDocId), { data: queue });
  };

  const saveTables = async (date, tables, location) => {
    const formattedTables = tables.map((table) => ({
      ...table,
      startTime: table.startTime
        ? new Date(table.startTime).toISOString()
        : null,
      endTime: table.endTime ? new Date(table.endTime).toISOString() : null,
      location,
    }));
    await setDoc(doc(db, "tables", `${location}_${date}`), {
      data: formattedTables,
    });
  };

  useEffect(() => {
    if (!selectedLocation) return;

    const queueDocId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseQueue"
        : "newHouseQueue";
    const unsub = onSnapshot(
      doc(db, "queue", queueDocId),
      (docSnap) => {
        const queue = docSnap.exists() ? docSnap.data().data : [];
        setQueueData(queue);
      },
      (error) => {
        console.error("Firestore listener error:", error);
      }
    );
    return () => unsub();
  }, [selectedLocation]);

  const handleAddQueue = (values) => {
    const newEntry = {
      id: Date.now(),
      name: values.name,
      mobile: values.mobile,
      gameTypes: values.gameTypes,
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
    };
    const updatedQueue = [...queueData, newEntry];
    setQueueData(updatedQueue);
    saveQueue(updatedQueue);
    setShowAddModal(false);
    form.resetFields();
  };

  const handleAppointTable = (values) => {
    if (!selectedCustomer) return;

    // Remove from queue
    const updatedQueue = queueData.filter(
      (item) => item.id !== selectedCustomer.id
    );
    setQueueData(updatedQueue);
    saveQueue(updatedQueue);

    // Add to active tables
    const newTableEntry = {
      id: uuidv4(),
      table: values.appointmentOption,
      name: selectedCustomer.name,
      phone: selectedCustomer.mobile,
      startTime: new Date().toISOString(),
      orderedItems: [],
      totalAmount: 0,
      gameType: values.appointmentOption.includes("Table")
        ? "8-ball Pool"
        : values.appointmentOption.includes("Controller")
        ? "PS"
        : "Table Tennis",
      isClosed: false,
      location: selectedLocation,
      cashAmount: 0,
      onlineAmount: 0,
    };

    setActiveTables((prevTables) => {
      const updatedTables = [...prevTables, newTableEntry];
      saveTables(selectedDate, updatedTables, selectedLocation);
      return updatedTables;
    });

    setShowAppointModal(false);
    appointForm.resetFields();
    setSelectedCustomer(null);
  };

  const openAppointModal = (record) => {
    setSelectedCustomer(record);
    setShowAppointModal(true);
    appointForm.setFieldsValue({
      name: record.name,
      mobile: record.mobile,
    });
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Mobile Number",
      dataIndex: "mobile",
      key: "mobile",
    },
    {
      title: "Game Types",
      dataIndex: "gameTypes",
      key: "gameTypes",
      render: (gameTypes) => gameTypes.join(", "),
    },
    {
      title: "Added At",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (timestamp) => moment(timestamp).format("DD MMM YYYY, hh:mm A"),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
          type="primary"
          onClick={() => openAppointModal(record)}
          style={styles.appointButton}
        >
          Appoint Table
        </Button>
      ),
    },
  ];

  if (!selectedLocation) return null;

  return (
    <div>
      <Navbar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
      />
      <Card style={styles.card}>
        <Title level={3} style={styles.title}>
          🎱 {selectedLocation} Queue Waiting List
        </Title>

        <Button
          type="primary"
          onClick={() => setShowAddModal(true)}
          style={styles.addButton}
        >
          Join Queue
        </Button>

        <Table
          dataSource={queueData}
          columns={columns}
          rowKey="id"
          bordered
          pagination={false}
          style={styles.table}
        />

        <Modal
          title="Join the Queue"
          open={showAddModal}
          onCancel={() => setShowAddModal(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddQueue}>
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: "Please enter your name" }]}
            >
              <Input placeholder="Enter your name" />
            </Form.Item>

            <Form.Item
              name="mobile"
              label="Mobile Number"
              rules={[
                { required: true, message: "Please enter your mobile number" },
                {
                  pattern: /^[0-9]{10}$/,
                  message: "Please enter a valid 10-digit mobile number",
                },
              ]}
            >
              <Input placeholder="Enter your mobile number" />
            </Form.Item>

            <Form.Item
              name="gameTypes"
              label="Game Types"
              rules={[
                {
                  required: true,
                  message: "Please select at least one game type",
                },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Select game types"
                allowClear
              >
                {GAME_TYPES.filter((type) => {
                  if (selectedLocation === LOCATIONS.OLD_HOUSE) return true;
                  return type !== "Table Tennis" && type !== "PS5"; // New House only has pool tables
                }).map((type) => (
                  <Option key={type} value={type}>
                    {type}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                style={styles.submitButton}
              >
                Add to Queue
              </Button>
              <Button
                onClick={() => setShowAddModal(false)}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Appoint Table/Controller"
          open={showAppointModal}
          onCancel={() => {
            setShowAppointModal(false);
            setSelectedCustomer(null);
            appointForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={appointForm}
            layout="vertical"
            onFinish={handleAppointTable}
          >
            <Form.Item name="name" label="Name">
              <Input disabled />
            </Form.Item>

            <Form.Item name="mobile" label="Mobile Number">
              <Input disabled />
            </Form.Item>

            <Form.Item
              name="appointmentOption"
              label="Select Table/Controller"
              rules={[{ required: true, message: "Please select an option" }]}
            >
              <Select placeholder="Select an option">
                {getAvailableOptions().length > 0 ? (
                  getAvailableOptions().map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))
                ) : (
                  <Option value="" disabled>
                    No available tables/controllers
                  </Option>
                )}
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                style={styles.submitButton}
              >
                Appoint
              </Button>
              <Button
                onClick={() => {
                  setShowAppointModal(false);
                  setSelectedCustomer(null);
                  appointForm.resetFields();
                }}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

const styles = {
  card: {
    margin: "20px",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.1)",
    background: "#ffffff",
  },
  title: {
    textAlign: "center",
    color: "#1890ff",
  },
  addButton: {
    marginBottom: "15px",
    backgroundColor: "#52c41a",
    borderColor: "#52c41a",
  },
  appointButton: {
    backgroundColor: "#1890ff",
    borderColor: "#1890ff",
  },
  table: {
    marginTop: "10px",
    borderRadius: "8px",
    overflow: "hidden",
  },
  submitButton: {
    marginRight: "10px",
  },
  cancelButton: {
    marginLeft: "10px",
  },
};

export default Queue;
