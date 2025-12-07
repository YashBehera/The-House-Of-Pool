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
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form] = Form.useForm();
  const [appointForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState(
    moment().format("YYYY-MM-DD")
  );
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [customerToRemove, setCustomerToRemove] = useState(null);
  const [ITEM_PRICES, setITEM_PRICES] = useState({});
  const [paymentFormErrors, setPaymentFormErrors] = useState([]);

  const GAME_TYPES = [
    "Small Table",
    "Medium Table",
    "Large Table",
    "Table Tennis",
    "PS5",
  ];

  // Sync activeTables with Firestore
  useEffect(() => {
    if (!selectedLocation || !selectedDate) return;

    const tablesDocId = `${selectedLocation}_${selectedDate}`;
    const unsub = onSnapshot(
      doc(db, "tables", tablesDocId),
      (docSnap) => {
        const tables = docSnap.exists() ? docSnap.data().data : [];
        setActiveTables(tables);
      },
      (error) => {
        console.error("Error fetching active tables:", error);
        setActiveTables([]);
      }
    );
    return () => unsub();
  }, [selectedLocation, selectedDate, setActiveTables]);

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

    const docSnap = await getDoc(inventoryRef);
    const currentInventory = docSnap.exists() ? docSnap.data().data : {};

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

    await setDoc(inventoryRef, { data: updatedInventory });
  };

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
        ? "Play Station"
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

  const handleEditQueue = (values) => {
    if (!selectedCustomer) return;

    const updatedFoodItems = selectedCustomer.foodItems || {};
    const updatedQueue = queueData.map((customer) =>
      customer.id === selectedCustomer.id
        ? {
            ...customer,
            name: values.name,
            mobile: values.mobile,
            gameTypes: values.gameTypes,
            foodItems: updatedFoodItems,
          }
        : customer
    );

    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);
    setShowEditModal(false);
    editForm.resetFields();
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

  const openEditModal = (record) => {
    setSelectedCustomer(record);
    setShowEditModal(true);
    editForm.setFieldsValue({
      name: record.name,
      mobile: record.mobile,
      gameTypes: record.gameTypes,
    });
  };

  const handleCancelAppointModal = () => {
    setShowAppointModal(false);
  };

  const handleCancelEditModal = () => {
    setShowEditModal(false);
    setSelectedCustomer(null);
    editForm.resetFields();
  };

  const handleRemoveFromQueue = (record) => {
    setCustomerToRemove(record);
    const hasFoodItems =
      record.foodItems && Object.keys(record.foodItems).length > 0;
    if (hasFoodItems) {
      setShowPaymentModal(true);
      paymentForm.setFieldsValue({
        cashAmount: 0,
        onlineAmount: 0,
      });
    } else {
      setShowRemoveConfirmModal(true);
    }
  };

  const calculateTotalFoodAmount = (foodItems) => {
    return Object.entries(foodItems).reduce(
      (total, [item, qty]) => total + (ITEM_PRICES[item] || 0) * qty,
      0
    );
  };

  const handlePaymentSubmit = async (values) => {
    if (!customerToRemove) return;

    const orderedItems = Object.entries(
      customerToRemove.foodItems || {}
    ).flatMap(([item, qty]) => Array(qty).fill(item));
    const totalAmount = calculateTotalFoodAmount(
      customerToRemove.foodItems || {}
    );
    const cashAmount = parseFloat(values.cashAmount) || 0;
    const onlineAmount = parseFloat(values.onlineAmount) || 0;

    await updateInventory(customerToRemove.foodItems || {});

    setActiveTables((prevTables) => {
      // Case-insensitive check for "FOOD" or "Food"
      const foodRowIndex = prevTables.findIndex(
        (table) =>
          table.table.toLowerCase() === "food" &&
          table.location === selectedLocation
      );

      let updatedTables;
      if (foodRowIndex !== -1) {
        // Update existing FOOD row (regardless of case)
        updatedTables = prevTables.map((table, index) =>
          index === foodRowIndex
            ? {
                ...table,
                table: "Food", // Standardize to uppercase
                name: "FOOD",
                phone: "-", // Standardize phone
                orderedItems: [...(table.orderedItems || []), ...orderedItems],
                totalAmount: (table.totalAmount || 0) + totalAmount,
                cashAmount: (table.cashAmount || 0) + cashAmount,
                onlineAmount: (table.onlineAmount || 0) + onlineAmount,
                startTime: null, // Keep original or set new
                endTime: null, // Update endTime
                isClosed: true,
                gameType: "Food",
              }
            : table
        );
      } else {
        // Create new FOOD row
        const newFoodEntry = {
          id: uuidv4(),
          table: "FOOD",
          name: "FOOD",
          phone: "-",
          startTime: null,
          endTime: null,
          orderedItems,
          totalAmount,
          cashAmount,
          onlineAmount,
          isClosed: true,
          location: selectedLocation,
          gameType: "Food",
        };
        updatedTables = [...prevTables, newFoodEntry];
      }

      saveTables(selectedDate, updatedTables, selectedLocation);
      return updatedTables;
    });

    const updatedQueue = queueData.filter(
      (item) => item.id !== customerToRemove.id
    );
    setQueueData(updatedQueue);
    saveQueue(updatedQueue, selectedDate);

    setShowPaymentModal(false);
    setCustomerToRemove(null);
    paymentForm.resetFields();
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
            type="default"
            onClick={() => openEditModal(record)}
            style={styles.editButton}
          >
            Edit
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
          title="Edit Queue Member"
          open={showEditModal}
          onCancel={handleCancelEditModal}
          footer={null}
        >
          <Form form={editForm} layout="vertical" onFinish={handleEditQueue}>
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
                Save Changes
              </Button>
              <Button
                onClick={handleCancelEditModal}
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

        <Modal
          title={
            <span
              style={{ fontSize: "18px", fontWeight: "600", color: "#333" }}
            >
              Payment for Food Items
            </span>
          }
          open={showPaymentModal}
          onCancel={() => {
            setShowPaymentModal(false);
            setCustomerToRemove(null);
            paymentForm.resetFields();
            setPaymentFormErrors([]); // Reset errors on cancel
          }}
          footer={null}
          style={{ top: 40 }}
          bodyStyle={{
            padding: "20px",
            background: "#fff",
          }}
        >
          <Form
            form={paymentForm}
            layout="vertical"
            onFinish={(values) => {
              const cash = parseFloat(values.cashAmount) || 0;
              const online = parseFloat(values.onlineAmount) || 0;
              const total = calculateTotalFoodAmount(
                customerToRemove?.foodItems || {}
              );

              setPaymentFormErrors([]);
              const errors = [];
              if (total > 0 && cash === 0 && online === 0) {
                errors.push("Cash or Online must be greater than 0");
              }
              if (cash + online !== total) {
                errors.push("Cash + Online must equal Total Amount");
              }
              if (cash < 0) {
                errors.push("Cash amount cannot be negative");
              }
              if (online < 0) {
                errors.push("Online amount cannot be negative");
              }

              if (errors.length > 0) {
                setPaymentFormErrors(errors);
                return;
              }

              // Proceed with payment submission if no errors
              handlePaymentSubmit(values);
            }}
            style={{ marginTop: "10px" }}
          >
            {/* Error Display */}
            {paymentFormErrors.length > 0 && (
              <div
                style={{
                  backgroundColor: "#fff1f0",
                  border: "1px solid #ffa39e",
                  borderRadius: "4px",
                  padding: "10px",
                  marginBottom: "16px",
                  color: "#cf1322",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <div>
                  {paymentFormErrors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <p
                style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}
              >
                <span style={{ fontWeight: "600", color: "#333" }}>
                  Customer:
                </span>{" "}
                {customerToRemove?.name}
              </p>
              <p
                style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}
              >
                <span style={{ fontWeight: "600", color: "#333" }}>
                  Food Items:
                </span>{" "}
                {customerToRemove?.foodItems &&
                Object.keys(customerToRemove.foodItems).length > 0
                  ? Object.entries(customerToRemove.foodItems)
                      .map(([item, qty]) => `${qty} ${item}`)
                      .join(", ")
                  : "None"}
              </p>
              <p style={{ margin: "0", fontSize: "14px", color: "#666" }}>
                <span style={{ fontWeight: "600", color: "#333" }}>
                  Total Amount:
                </span>{" "}
                <span style={{ fontWeight: "600", color: "#000" }}>
                  Rs{" "}
                  {calculateTotalFoodAmount(customerToRemove?.foodItems || {})}
                </span>
              </p>
            </div>

            <Form.Item
              name="onlineAmount"
              label={
                <span style={{ fontWeight: "600", color: "#333" }}>
                  Online Amount
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please enter online amount (0 if none)",
                },
              ]}
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Enter online amount"
                prefix="Rs"
                style={{
                  borderRadius: "4px",
                }}
              />
            </Form.Item>

            <Form.Item
              name="cashAmount"
              label={
                <span style={{ fontWeight: "600", color: "#333" }}>
                  Cash Amount
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please enter cash amount (0 if none)",
                },
              ]}
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Enter cash amount"
                prefix="Rs"
                style={{
                  borderRadius: "4px",
                }}
              />
            </Form.Item>
            <Form.Item>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{
                    ...styles.submitButton,
                    backgroundColor: "#1890ff",
                    borderColor: "#1890ff",
                    borderRadius: "4px",
                    padding: "4px 16px",
                  }}
                >
                  Confirm Payment
                </Button>
                <Button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setCustomerToRemove(null);
                    paymentForm.resetFields();
                    setPaymentFormErrors([]); // Reset errors on cancel
                  }}
                  style={{
                    ...styles.cancelButton,
                    borderRadius: "4px",
                    padding: "4px 16px",
                  }}
                >
                  Cancel
                </Button>
              </div>
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
  editButton: {
    backgroundColor: "#fa8c16",
    borderColor: "#fa8c16",
    color: "white",
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
