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
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore"; // Added getDoc
import { db } from "./firebase";
import Navbar from "./Navbar";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";

const { Title } = Typography;
const { Option } = Select;

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
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [customerToRemove, setCustomerToRemove] = useState(null);
  const [ITEM_PRICES, setITEM_PRICES] = useState({});

  const GAME_TYPES = [
    "Small Table",
    "Medium Table",
    "Large Table",
    "Table Tennis",
    "PS5",
  ];

  useEffect(() => {
    if (!selectedLocation) return;

    const docId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseStock"
        : "newHouseStock";
    const unsubscribe = onSnapshot(
      doc(db, "inventory", docId),
      (docSnap) => {
        const inventory = docSnap.exists() ? docSnap.data().data : {};
        const prices = {};
        Object.entries(inventory).forEach(([item, values]) => {
          prices[item] = values.price || 0;
        });
        setITEM_PRICES(prices);
      },
      (error) => {
        console.error("Error fetching inventory:", error);
        setITEM_PRICES({});
      }
    );

    return () => unsubscribe();
  }, [selectedLocation]);

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

  const getAvailableOptions = () => {
    const allOptions = getAllAppointmentOptions();
    const activeTableNames = activeTables
      .filter((table) => !table.isClosed && table.location === selectedLocation)
      .map((table) => table.table);

    return allOptions.filter((option) => !activeTableNames.includes(option));
  };

  const saveQueue = async (queue, date) => {
    const queueDocId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? `oldHouseQueue_${date}`
        : `newHouseQueue_${date}`;
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

  const updateInventory = async (foodItems) => {
    const inventoryDocId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? "oldHouseStock"
        : "newHouseStock";
    const inventoryRef = doc(db, "inventory", inventoryDocId);

    // Fetch current inventory using getDoc
    const docSnap = await getDoc(inventoryRef);
    const currentInventory = docSnap.exists() ? docSnap.data().data : {};

    // Update inventory based on selected food items
    const updatedInventory = { ...currentInventory };
    Object.entries(foodItems).forEach(([item, qty]) => {
      if (updatedInventory[item]) {
        updatedInventory[item].available = Math.max(
          0,
          updatedInventory[item].available - qty
        );
        updatedInventory[item].sold = (updatedInventory[item].sold || 0) + qty;
      }
    });

    // Save updated inventory
    await setDoc(inventoryRef, { data: updatedInventory });
  };

  useEffect(() => {
    if (!selectedLocation || !selectedDate) return;

    const queueDocId =
      selectedLocation === LOCATIONS.OLD_HOUSE
        ? `oldHouseQueue_${selectedDate}`
        : `newHouseQueue_${selectedDate}`;
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
  }, [selectedLocation, selectedDate]);

  const handleAddQueue = (values) => {
    const newEntry = {
      id: Date.now(),
      name: values.name,
      mobile: values.mobile,
      gameTypes: values.gameTypes,
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      foodItems: {},
    };
    const updatedQueue = [...queueData, newEntry];
    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);
    setShowAddModal(false);
    form.resetFields();
  };

  const handleIncreaseItem = (item) => {
    if (!selectedCustomer) return;

    const updatedFoodItems = {
      ...selectedCustomer.foodItems,
      [item]: (selectedCustomer.foodItems?.[item] || 0) + 1,
    };

    const updatedQueue = queueData.map((customer) =>
      customer.id === selectedCustomer.id
        ? { ...customer, foodItems: updatedFoodItems }
        : customer
    );

    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);

    setSelectedCustomer((prev) => ({
      ...prev,
      foodItems: updatedFoodItems,
    }));
  };

  const handleDecreaseItem = (item) => {
    if (!selectedCustomer) return;

    const currentQty = selectedCustomer.foodItems?.[item] || 0;
    const newQty = currentQty - 1;
    const updatedFoodItems = { ...selectedCustomer.foodItems };

    if (newQty <= 0) {
      delete updatedFoodItems[item];
    } else {
      updatedFoodItems[item] = newQty;
    }

    const updatedQueue = queueData.map((customer) =>
      customer.id === selectedCustomer.id
        ? { ...customer, foodItems: updatedFoodItems }
        : customer
    );

    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);

    setSelectedCustomer((prev) => ({
      ...prev,
      foodItems: updatedFoodItems,
    }));
  };

  const handleAppointTable = async (values) => {
    if (!selectedCustomer) return;

    const now = moment(selectedDate);
    const [hours, minutes] = values.startTime.split(":");
    const startTime = now
      .clone()
      .set({
        hour: parseInt(hours),
        minute: parseInt(minutes),
        second: 0,
        millisecond: 0,
      })
      .toISOString();

    const orderedItems = Object.entries(
      selectedCustomer.foodItems || {}
    ).flatMap(([item, qty]) => Array(qty).fill(item));

    await updateInventory(selectedCustomer.foodItems || {});

    const updatedQueue = queueData.filter(
      (item) => item.id !== selectedCustomer.id
    );
    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);

    const newTableEntry = {
      id: uuidv4(),
      table: values.appointmentOption,
      name: selectedCustomer.name,
      phone: selectedCustomer.mobile,
      startTime: startTime,
      orderedItems: orderedItems,
      totalAmount: 0,
      gameType: values.appointmentOption.includes("Table")
        ? "Snooker Table"
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
      startTime: moment().format("HH:mm"),
    });
  };

  const handleCancelAppointModal = () => {
    setShowAppointModal(false);
  };

  const handleRemoveFromQueue = (record) => {
    setCustomerToRemove(record);
    setShowRemoveConfirmModal(true);
  };

  const confirmRemoveItem = () => {
    if (!customerToRemove) return;
    const updatedQueue = queueData.filter(
      (item) => item.id !== customerToRemove.id
    );
    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);
    setShowRemoveConfirmModal(false);
    setCustomerToRemove(null);
  };

  const cancelRemoveItem = () => {
    setShowRemoveConfirmModal(false);
    setCustomerToRemove(null);
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
      title: "Food Items",
      dataIndex: "foodItems",
      key: "foodItems",
      render: (foodItems) =>
        foodItems && Object.keys(foodItems).length > 0
          ? Object.entries(foodItems)
              .map(([item, qty]) => `${qty} ${item}`)
              .join(", ")
          : "—",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            type="primary"
            onClick={() => openAppointModal(record)}
            style={styles.appointButton}
          >
            Appoint Table
          </Button>
          <Button
            type="danger"
            onClick={() => handleRemoveFromQueue(record)}
            style={styles.removeButton}
          >
            Remove
          </Button>
        </div>
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
          🎱 {selectedLocation} Waiting
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
                  return type !== "Table Tennis" && type !== "PS5";
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
          onCancel={handleCancelAppointModal}
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
            <Form.Item
              name="startTime"
              label="Start Time"
              rules={[
                { required: true, message: "Please select a start time" },
              ]}
            >
              <Input type="time" />
            </Form.Item>
            <Form.Item label="Food Items (Optional)">
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {Object.keys(ITEM_PRICES).map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <span>
                      {item} (Rs {ITEM_PRICES[item]})
                    </span>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <Button
                        size="small"
                        onClick={() => handleDecreaseItem(item)}
                        disabled={!selectedCustomer?.foodItems?.[item]}
                      >
                        ➖
                      </Button>
                      <span>{selectedCustomer?.foodItems?.[item] || 0}</span>
                      <Button
                        size="small"
                        onClick={() => handleIncreaseItem(item)}
                      >
                        ➕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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
                onClick={handleCancelAppointModal}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </Form.Item>
          </Form>
        </Modal>
        <Modal
          title="Confirm Removal"
          open={showRemoveConfirmModal}
          onOk={confirmRemoveItem}
          onCancel={cancelRemoveItem}
          okText="Yes"
          okButtonProps={{ danger: true }}
          cancelText="No"
        >
          <p>
            Are you sure you want to remove{" "}
            <strong>{customerToRemove?.name}</strong> from the queue?
          </p>
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
  removeButton: {
    backgroundColor: "#ff4d4f",
    borderColor: "#ff4d4f",
    color: "white",
  },
};

export default Queue;
